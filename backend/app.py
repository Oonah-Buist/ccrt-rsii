"""
CCRT-RSII Flask Backend
A simple Flask server for the CCRT-RSII Initiative website
"""

from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import os

# Initialize Flask app with static folder pointing to parent directory
app = Flask(__name__, 
            static_folder='../',  # Serve static files from parent directory
            static_url_path='')   # No prefix for static files

# Enable CORS for all routes to allow frontend communication
CORS(app)

# Configuration
app.config['DEBUG'] = True
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Route to serve the main website
@app.route('/')
def serve_index():
    """Serve the main index.html page"""
    return send_file('../index.html')

# Route to serve other HTML pages
@app.route('/<path:filename>')
def serve_static_files(filename):
    """Serve static files (HTML, CSS, JS, images)"""
    # If it's an HTML file without extension, add .html
    if '.' not in filename and not filename.startswith('api/'):
        filename = f"{filename}.html"
    
    try:
        return send_from_directory('..', filename)
    except FileNotFoundError:
        # If file not found and it's not an API route, return 404 page or index
        if not filename.startswith('api/'):
            return send_file('../index.html')  # Fallback to index for SPA-like behavior
        return jsonify({'error': 'Not found'}), 404

# Health check endpoint (moved to API namespace)
@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'CCRT-RSII Backend is running',
        'version': '1.0.0'
    })

# API status endpoint
@app.route('/api/status')
def api_status():
    """API status endpoint"""
    return jsonify({
        'api_status': 'active',
        'endpoints': [
            '/ - Main website (index.html)',
            '/api/health - Health check',
            '/api/status - API status',
            '/<page> - Serve HTML pages',
            # Future endpoints will be added here
        ]
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Run the development server
    app.run(
        host='127.0.0.1',
        port=5001,
        debug=True
    )
