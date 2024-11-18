const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5500;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Define a route to serve the index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
