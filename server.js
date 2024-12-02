const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "http://localhost:3000" })); // Allow requests from frontend
app.use(express.json()); // Middleware for parsing JSON bodies

// MySQL database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "dynamic",
  password: "password123",
  database: "dynamic_todo", // Name of the database
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    process.exit();
  }
  console.log("Connected to MySQL database.");
});

// JWT Secret Key
const JWT_SECRET = "supersecretkey";

// Middleware for Authenticated Routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    console.log("No token provided.");
    return res.status(401).json({ message: "Token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Invalid or expired token.");
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    console.log("Authenticated User:", user); // Log user data
    next();
  });
};

// User Registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, hashedPassword],
      (err) => {
        if (err) {
          console.error("Database Error:", err.message);
          return res.status(400).json({ message: "User already exists" });
        }
        res.json({ message: "User registered successfully" });
      }
    );
  } catch (err) {
    res.status(500).json({ message: "Server error during registration" });
  }
});

// User Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err || results.length === 0) {
        console.error("Database Error or User Not Found:", err?.message);
        return res.status(400).json({ message: "Invalid username or password" });
      }

      const user = results[0];
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return res.status(400).json({ message: "Invalid username or password" });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });
      res.json({ token });
    }
  );
});

// Fetch all tasks for the authenticated user
app.get("/tasks", authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.query(
    "SELECT tasks.id, tasks.title, tasks.description, tasks.status FROM tasks INNER JOIN user_tasks ON tasks.id = user_tasks.task_id WHERE user_tasks.user_id = ? ORDER BY tasks.status DESC, tasks.created_at DESC",
    [userId],
    (err, results) => {
      if (err) {
        console.error("Database Error:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    }
  );
});

// Add a new task
app.post("/tasks", authenticateToken, (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.id;

  if (!title || !description) {
    return res.status(400).json({ message: "Title and description are required" });
  }

  db.beginTransaction((err) => {
    if (err) {
      console.error("Transaction Error:", err.message);
      return res.status(500).json({ error: "Transaction error" });
    }

    // Insert task into the tasks table
    db.query(
      "INSERT INTO tasks (title, description, status) VALUES (?, ?, 0)", // Default status is 0
      [title, description],
      (err, result) => {
        if (err) {
          return db.rollback(() => {
            console.error("Error inserting into tasks:", err.message);
            return res.status(500).json({ error: "Failed to add task" });
          });
        }
        const taskId = result.insertId;

        // Explicitly retrieve the newly created task to ensure it exists
        db.query(
          "SELECT * FROM tasks WHERE id = ?",
          [taskId],
          (err, taskResults) => {
            if (err || taskResults.length === 0) {
              return db.rollback(() => {
                console.error("Error retrieving newly created task:", err?.message);
                return res.status(500).json({ error: "Failed to retrieve newly created task" });
              });
            }

            // Check if user-task relationship already exists
            db.query(
              "SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ?",
              [userId, taskId],
              (err, results) => {
                if (err) {
                  return db.rollback(() => {
                    console.error("Error checking user_tasks:", err.message);
                    return res.status(500).json({ error: "Failed to check user-task relationship" });
                  });
                }

                if (results.length > 0) {
                  return db.rollback(() => {
                    console.error("Duplicate entry for user and task");
                    return res.status(400).json({ error: "User-task relationship already exists" });
                  });
                }

                // Link the new task to the user in the user_tasks table
                db.query(
                  "INSERT INTO user_tasks (user_id, task_id) VALUES (?, ?)",
                  [userId, taskId],
                  (err) => {
                    if (err) {
                      return db.rollback(() => {
                        console.error("Error inserting into user_tasks:", err.message);
                        return res.status(500).json({ error: "Failed to link task to user" });
                      });
                    }

                    db.commit((err) => {
                      if (err) {
                        return db.rollback(() => {
                          console.error("Commit Error:", err.message);
                          return res.status(500).json({ error: "Failed to commit transaction" });
                        });
                      }
                      res.status(201).json({ message: "Task added successfully", taskId });
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// Update task status
app.put("/tasks/:taskId/status", authenticateToken, (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  if (isNaN(status) || status < 0 || status > 100) {
    return res.status(400).json({ message: "Status must be a number between 0 and 100" });
  }

  db.query(
    "UPDATE tasks SET status = ? WHERE id = ? AND EXISTS (SELECT 1 FROM user_tasks WHERE user_id = ? AND task_id = ?)",
    [status, taskId, userId, taskId],
    (err) => {
      if (err) {
        console.error("Database Error:", err.message);
        return res.status(500).json({ error: "Failed to update task status" });
      }
      res.json({ message: "Task status updated successfully" });
    }
  );
});

// Delete a task
app.delete("/tasks/:taskId", authenticateToken, (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  db.query(
    "SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ?",
    [userId, taskId],
    (err, results) => {
      if (err) {
        console.error("Database Error:", err.message);
        return res.status(500).json({ error: "Failed to verify task ownership" });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: "Task not found or not authorized" });
      }

      db.query(
        "DELETE FROM tasks WHERE id = ?",
        [taskId],
        (err) => {
          if (err) {
            console.error("Database Error:", err.message);
            return res.status(500).json({ error: "Failed to delete task" });
          }
          db.query(
            "DELETE FROM user_tasks WHERE user_id = ? AND task_id = ?",
            [userId, taskId],
            (err) => {
              if (err) {
                console.error("Database Error:", err.message);
                return res.status(500).json({ error: "Failed to unlink task" });
              }
              res.json({ message: "Task deleted successfully" });
            }
          );
        }
      );
    }
  );
});

// Start the server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
//
