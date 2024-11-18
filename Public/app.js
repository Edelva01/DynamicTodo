async function register(username, password) {
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (response.ok) {
        alert('User registered successfully');
    } else {
        alert('Registration failed');
    }
}

async function login(username, password) {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        alert('Login successful');
    } else {
        alert('Login failed');
    }
}

async function addTask(text, priority) {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token 
        },
        body: JSON.stringify({ text, priority })
    });
    if (response.ok) {
        alert('Task added successfully');
    } else {
        alert('Failed to add task');
    }
}
