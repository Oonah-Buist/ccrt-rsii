# CCRT RSII Backend

This is a Node.js/Express backend for secure user management, authentication, and form assignment/completion tracking.

## Features
- Admin and participant user management
- Secure password storage (bcrypt)
- JWT authentication
- SQLite database (easy to upgrade to PostgreSQL/MySQL)
- Endpoints for login, logout, password change, and participant password assignment
- Ready for form assignment and completion tracking

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the server:
   ```sh
   node index.js
   ```

## Environment Variables
Create a `.env` file in the root with:
```
JWT_SECRET=your_jwt_secret_here
```

## Next Steps
- Implement endpoints for form assignment and completion tracking
- Integrate with the front end

---

For questions, contact the project maintainer.
