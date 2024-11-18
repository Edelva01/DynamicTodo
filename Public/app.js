const express = require('express');
const {readFile} = require('fs').promises;
const app = express();
app.get('/', async(request, response) => {
        response.send(await readFile('https://edelva01.github.io/DynamicTodo/', "utf8"));    
});
app.listen(5500, () => {
    console.log('Server is running on http://localhost:5500');
});