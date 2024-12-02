import React, { useState, useEffect, useCallback } from "react";
import "./App.css";

const BASE_URL = "http://localhost:5000"; // Backend base URL

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(true);
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [welcomeUsername, setWelcomeUsername] = useState(""); // Store logged-in username

  // Helper function for authenticated requests
  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem("token");
    if (!options.headers) options.headers = {};
    if (token) options.headers.Authorization = `Bearer ${token}`;
    return fetch(url, options);
  };

  // Fetch tasks from the backend
  const fetchTasks = useCallback(async () => {
    try {
      const response = await authFetch(`${BASE_URL}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        console.error("Failed to fetch tasks.");
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, []);

  // Handle token and username retrieval on page load
  useEffect(() => {
    const token = localStorage.getItem("token");
    const loggedUsername = localStorage.getItem("username");
    if (token) {
      setIsAuthenticated(true);
      setWelcomeUsername(loggedUsername);
      fetchTasks();
    }
  }, [fetchTasks]);

  // Handle registration or login
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegisterMode ? "register" : "login";
    try {
      const response = await fetch(`${BASE_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        if (isRegisterMode) {
          alert("User registered successfully! Please log in.");
          setIsRegisterMode(false);
        } else {
          const data = await response.json();
          localStorage.setItem("token", data.token);
          localStorage.setItem("username", username);
          setIsAuthenticated(true);
          setWelcomeUsername(username);
          fetchTasks();
        }
      } else {
        const error = await response.json();
        alert(error.message || `Failed to ${isRegisterMode ? "register" : "log in"}.`);
      }
    } catch (error) {
      console.error("Error during authentication:", error);
    }
  };

  // Add a new task
  const addTask = async (e) => {
    e.preventDefault();
    try {
      const response = await authFetch(`${BASE_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });
      if (response.ok) {
        fetchTasks();
        setNewTask({ title: "", description: "" });
      } else {
        const error = await response.json();
        alert(error.message || "Failed to add task.");
      }
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  // Update task status
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const response = await authFetch(`${BASE_URL}/tasks/${taskId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        fetchTasks();
      } else {
        console.error("Failed to update task status.");
      }
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  // Delete a task
  const deleteTask = async (taskId) => {
    try {
      const response = await authFetch(`${BASE_URL}/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        alert("Task deleted successfully");
        fetchTasks();
      } else {
        const error = await response.json();
        alert(error.message || "Failed to delete task.");
      }
    } catch (error) {
      console.error("Error during task deletion:", error);
    }
  };

  // Handle slider change for task status
  const handleSliderChange = (taskId, value) => {
    const intValue = parseInt(value, 10);
    updateTaskStatus(taskId, intValue);
  };

  // Handle manual input for task status
  const handleManualInput = (taskId, value) => {
    const intValue = parseInt(value, 10);
    if (intValue >= 0 && intValue <= 100) {
      updateTaskStatus(taskId, intValue);
    }
  };

  // Reactivate a completed task
  const reactivateTask = async (taskId) => {
    updateTaskStatus(taskId, 99);
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
    setTasks([]);
  };

  // Filter tasks
  const incompleteTasks = tasks.filter((task) => task.status < 100);
  const completedTasks = tasks.filter((task) => task.status === 100);

  // Current date
  const todayDate = new Date().toLocaleDateString();

  return (
    <div className="App">
      <h1>Todo Application</h1>

      {isAuthenticated && (
        <div>
          <h3>
            Welcome, {welcomeUsername}! Today's date: {todayDate}
          </h3>
        </div>
      )}

      {!isAuthenticated ? (
        <div>
          <form onSubmit={handleAuthSubmit}>
            <h2>{isRegisterMode ? "Register" : "Login"}</h2>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">{isRegisterMode ? "Register" : "Login"}</button>
          </form>
          <button onClick={() => setIsRegisterMode(!isRegisterMode)}>
            Switch to {isRegisterMode ? "Login" : "Register"}
          </button>
        </div>
      ) : (
        <div>
          <button onClick={logout}>Logout</button>
          <form className="task-form" onSubmit={addTask}>
            <h2>Add Task</h2>
            <input
              type="text"
              placeholder="Task Title"
              value={newTask.title}
              onChange={(e) =>
                setNewTask({ ...newTask, title: e.target.value })
              }
              required
            />
            <textarea
              placeholder="Task Description"
              value={newTask.description}
              onChange={(e) =>
                setNewTask({ ...newTask, description: e.target.value })
              }
              required
            ></textarea>
            <button type="submit">Add Task</button>
          </form>

          <h2>Your Tasks</h2>
          <div className="tasks">
            {incompleteTasks.map((task) => (
              <div className="task" key={task.id}>
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <p>Status: {task.status}%</p>
                <label>
                  Update Status:
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={task.status}
                    onChange={(event) =>
                      handleSliderChange(task.id, event.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="10"
                    value={task.status}
                    onChange={(e) =>
                      handleManualInput(task.id, parseInt(e.target.value, 10))
                    }
                    style={{
                      width: "60px",
                      marginLeft: "10px",
                      textAlign: "center",
                    }}
                  />
                </label>
                <button
                  onClick={() => deleteTask(task.id)}
                  style={{ marginLeft: "10px" }}
                >
                  Delete Task
                </button>
              </div>
            ))}

            <h2>Completed Tasks</h2>
            {completedTasks.map((task) => (
              <div className="task completed" key={task.id}>
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <p>Status: {task.status}%</p>
                <button
                  onClick={() => reactivateTask(task.id)}
                  style={{ marginRight: "10px", marginBottom: "5px" }}
                >
                  Reactivate Task
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  style={{ marginLeft: "10px", marginBottom: "5px" }}
                >
                  Delete Task
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
