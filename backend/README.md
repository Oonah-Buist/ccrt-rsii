# CCRT-RSII Backend

A simple Flask backend for the CCRT-RSII Initiative website.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Run the development server:
   ```bash
   python app.py
   ```

The server will start on `http://127.0.0.1:5000`

## Endpoints

- `GET /` - Health check
- `GET /api/status` - API status

## Future Features

This backend is set up for future implementation of:
- User authentication and registration
- Contact form handling
- Participant application processing
- Data storage and retrieval
- Email notifications
