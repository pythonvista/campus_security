const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'campus-security-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Database files
const DB_DIR = './data';
const USERS_FILE = path.join(DB_DIR, 'users.json');
const INCIDENTS_FILE = path.join(DB_DIR, 'incidents.json');
const ALERTS_FILE = path.join(DB_DIR, 'alerts.json');

// File upload directories
const UPLOADS_DIR = './uploads';
const PHOTOS_DIR = path.join(UPLOADS_DIR, 'photos');
const INCIDENT_IMAGES_DIR = path.join(UPLOADS_DIR, 'incidents');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    let uploadPath = UPLOADS_DIR;
    if (file.fieldname === 'profilePhoto' || file.fieldname === 'registrationPhoto') {
      uploadPath = PHOTOS_DIR;
    } else if (file.fieldname === 'incidentImage') {
      uploadPath = INCIDENT_IMAGES_DIR;
    }
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: fileFilter
});

// Make uploads directory accessible
app.use('/uploads', express.static(UPLOADS_DIR));

// Initialize database
async function initDatabase() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.mkdir(PHOTOS_DIR, { recursive: true });
    await fs.mkdir(INCIDENT_IMAGES_DIR, { recursive: true });
    
    // Initialize users file with admin, student, and staff users
    try {
      await fs.access(USERS_FILE);
    } catch {
      const adminPassword = await bcrypt.hash('admin123', 10);
      const studentPassword = await bcrypt.hash('student123', 10);
      const staffPassword = await bcrypt.hash('staff123', 10);
      const initialUsers = [
        {
          id: uuidv4(),
          username: 'admin',
          password: adminPassword,
          role: 'admin',
          userType: 'admin',
          name: 'System Administrator',
          email: 'admin@bamidele.edu.ng',
          studentId: null,
          department: 'IT Department',
          profilePhoto: null,
          registrationPhoto: null,
          createdAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          username: 'student001',
          password: studentPassword,
          role: 'user',
          userType: 'student',
          name: 'Fagbuaro Babatunde Michael',
          email: 'fagbuaro.babatunde@bamidele.edu.ng',
          studentId: '2789',
          department: 'Computer Science',
          profilePhoto: null,
          registrationPhoto: null,
          createdAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          username: 'staff001',
          password: staffPassword,
          role: 'user',
          userType: 'staff',
          name: 'Dr. John Smith',
          email: 'john.smith@bamidele.edu.ng',
          studentId: null,
          department: 'Computer Science',
          profilePhoto: null,
          registrationPhoto: null,
          createdAt: new Date().toISOString()
        }
      ];
      await fs.writeFile(USERS_FILE, JSON.stringify(initialUsers, null, 2));
    }
    
    // Initialize incidents file
    try {
      await fs.access(INCIDENTS_FILE);
    } catch {
      await fs.writeFile(INCIDENTS_FILE, JSON.stringify([], null, 2));
    }
    
    // Initialize alerts file
    try {
      await fs.access(ALERTS_FILE);
    } catch {
      await fs.writeFile(ALERTS_FILE, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Database helper functions
async function readData(file) {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${file}:`, error);
    return [];
  }
}

async function writeData(file, data) {
  try {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${file}:`, error);
    return false;
  }
}

// Face detection and student matching utility
// Simple image similarity matching based on file comparison
// For production, this should use proper face recognition API or library
async function findMatchingStudents(imagePath) {
  try {
    const users = await readData(USERS_FILE);
    const students = users.filter(u => u.userType === 'student' && u.registrationPhoto);
    
    if (students.length === 0) return [];
    
    // For now, return all students with photos as potential matches
    // In production, implement proper face recognition matching
    // This is a placeholder - actual face recognition would compare face embeddings
    const matches = students.map(student => ({
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      email: student.email,
      department: student.department,
      photo: student.registrationPhoto,
      matchConfidence: 0.85, // Placeholder confidence score
      registrationInfo: {
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        department: student.department,
        username: student.username
      }
    }));
    
    return matches;
  } catch (error) {
    console.error('Error finding matching students:', error);
    return [];
  }
}

// Generate thumbnail for images
async function generateThumbnail(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return false;
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

function requireAdmin(req, res, next) {
  if (req.session.userRole === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  const error = req.query.error;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Campus Security Management Platform - Login</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 50px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .school-name { font-size: 18px; font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
        .project-title { font-size: 16px; color: #34495e; margin-bottom: 10px; }
        .student-info { font-size: 14px; color: #7f8c8d; margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; color: #555; font-weight: bold; }
        input[type="text"], input[type="password"], select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .error { color: red; text-align: center; margin-top: 10px; }
        .demo-info { background: #e7f3ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; }
        .demo-section { margin-bottom: 10px; }
        .demo-section strong { display: block; margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="school-name">Bamidele Olumilua University of Education, Science and Technology</div>
          <div class="project-title">Campus Security Management Platform (CSMP)</div>
          <div class="student-info">Project by: Fagbuaro Babatunde Michael (Matric No: 2789)</div>
        </div>
        
        <h1>Login Portal</h1>
        <div class="demo-info">
          <div class="demo-section">
            <strong>Admin Access:</strong>
            Username: admin | Password: admin123
          </div>
          <div class="demo-section">
            <strong>Student Access:</strong>
            Username: student001 | Password: student123
          </div>
          <div class="demo-section">
            <strong>Staff Access:</strong>
            Username: staff001 | Password: staff123
          </div>
        </div>
        
        <form method="POST" action="/login">
          <div class="form-group">
            <label for="userType">Login As:</label>
            <select id="userType" name="userType" required>
              <option value="">Select user type...</option>
              <option value="admin">Administrator</option>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div class="form-group">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
          </div>
          <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
          </div>
          <button type="submit">Login</button>
        </form>
        <div id="error" class="error">${error === 'invalid' ? 'Invalid credentials or user type mismatch' : ''}</div>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', async (req, res) => {
  const { username, password, userType } = req.body;
  const users = await readData(USERS_FILE);
  const user = users.find(u => u.username === username && u.userType === userType);
  
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role;
    req.session.userType = user.userType;
    req.session.userName = user.name;
    req.session.studentId = user.studentId;
    req.session.department = user.department;
    res.redirect('/dashboard');
  } else {
    res.redirect('/login?error=invalid');
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const incidents = await readData(INCIDENTS_FILE);
  const alerts = await readData(ALERTS_FILE);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard - Campus Security Platform</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .nav { display: flex; justify-content: space-between; align-items: center; }
        .nav h1 { margin: 0; color: #333; }
        .nav a { color: #007bff; text-decoration: none; margin-left: 20px; }
        .nav a:hover { text-decoration: underline; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .action-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .action-card h3 { margin-top: 0; color: #333; }
        .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-top: 10px; }
        .btn:hover { background: #0056b3; }
        .recent-incidents { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 20px; }
        .incident-item { padding: 10px; border-bottom: 1px solid #eee; }
        .incident-item:last-child { border-bottom: none; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status.open { background: #ffebee; color: #c62828; }
        .status.investigating { background: #fff3e0; color: #ef6c00; }
        .status.resolved { background: #e8f5e8; color: #2e7d32; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="nav">
          <h1>Campus Security Dashboard</h1>
          <div>
            <span>Welcome, ${req.session.userName || req.session.username}</span>
            <span style="margin-left: 15px; color: #666;">(${req.session.userType})</span>
            ${req.session.studentId ? `<span style="margin-left: 10px; color: #666;">ID: ${req.session.studentId}</span>` : ''}
            <a href="/logout" style="margin-left: 20px;">Logout</a>
          </div>
        </div>
      </div>
      
      <div class="stats">
        <div class="stat-card">
          <div class="stat-number">${incidents.length}</div>
          <div class="stat-label">Total Incidents</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${incidents.filter(i => i.status === 'open').length}</div>
          <div class="stat-label">Open Incidents</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${alerts.length}</div>
          <div class="stat-label">Active Alerts</div>
        </div>
      </div>
      
      <div class="actions">
        <div class="action-card">
          <h3>Report Incident</h3>
          <p>Report a new security incident or emergency</p>
          <a href="/incidents/new" class="btn">Report Incident</a>
        </div>
        <div class="action-card">
          <h3>View Incidents</h3>
          <p>View and manage all reported incidents</p>
          <a href="/incidents" class="btn">View All</a>
        </div>
        ${req.session.userRole === 'admin' ? `
        <div class="action-card">
          <h3>Manage Users</h3>
          <p>Add and manage system users</p>
          <a href="/users" class="btn">Manage Users</a>
        </div>
        <div class="action-card">
          <h3>System Settings</h3>
          <p>Configure system settings and alerts</p>
          <a href="/settings" class="btn">Settings</a>
        </div>
        ` : ''}
      </div>
      
      <div class="recent-incidents">
        <h3>Recent Incidents</h3>
        ${incidents.slice(-5).reverse().map(incident => `
          <div class="incident-item">
            <strong>${incident.title}</strong>
            <span class="status ${incident.status}">${incident.status}</span>
            <br>
            <small>Reported by ${incident.reportedBy} on ${new Date(incident.createdAt).toLocaleDateString()}</small>
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `);
});

app.get('/incidents/new', requireAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Report Incident - Campus Security Platform</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 700px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; color: #555; font-weight: bold; }
        input[type="text"], input[type="email"], input[type="file"], select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        textarea { height: 100px; resize: vertical; }
        .btn { padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-right: 10px; }
        .btn:hover { background: #0056b3; }
        .btn-secondary { background: #6c757d; }
        .btn-secondary:hover { background: #545b62; }
        .priority-high { color: #dc3545; }
        .priority-medium { color: #ffc107; }
        .priority-low { color: #28a745; }
        .image-preview { margin-top: 10px; max-width: 300px; max-height: 300px; border: 2px solid #ddd; border-radius: 4px; display: none; }
        .file-info { margin-top: 5px; font-size: 12px; color: #666; }
        .feature-note { background: #e7f3ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #007bff; }
        .feature-note strong { display: block; margin-bottom: 5px; color: #007bff; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Report Security Incident</h1>
        <div class="feature-note">
          <strong>📸 Face Recognition Feature:</strong>
          Upload a photo of the incident scene or person involved. Our system will automatically identify students by matching faces with registration photos.
        </div>
        <form method="POST" action="/incidents" enctype="multipart/form-data">
          <div class="form-group">
            <label for="title">Incident Title:</label>
            <input type="text" id="title" name="title" required>
          </div>
          
          <div class="form-group">
            <label for="type">Incident Type:</label>
            <select id="type" name="type" required>
              <option value="">Select type...</option>
              <option value="theft">Theft</option>
              <option value="vandalism">Vandalism</option>
              <option value="unauthorized-access">Unauthorized Access</option>
              <option value="violence">Violence</option>
              <option value="emergency">Emergency</option>
              <option value="suspicious-activity">Suspicious Activity</option>
              <option value="dress-code-violation">Dress Code Violation</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="priority">Priority Level:</label>
            <select id="priority" name="priority" required>
              <option value="">Select priority...</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="location">Location:</label>
            <input type="text" id="location" name="location" required placeholder="Building, Room, or Area">
          </div>
          
          <div class="form-group">
            <label for="description">Description:</label>
            <textarea id="description" name="description" required placeholder="Provide detailed description of the incident..."></textarea>
          </div>
          
          <div class="form-group">
            <label for="contact">Your Contact:</label>
            <input type="text" id="contact" name="contact" required placeholder="Phone number or email">
          </div>
          
          <div class="form-group">
            <label for="incidentImage">Upload Photo (for face recognition):</label>
            <input type="file" id="incidentImage" name="incidentImage" accept="image/*" onchange="previewImage(this)">
            <div class="file-info">Supported formats: JPG, PNG, GIF, WEBP (Max 10MB)</div>
            <img id="imagePreview" class="image-preview" alt="Preview">
          </div>
          
          <button type="submit" class="btn">Submit Report</button>
          <a href="/dashboard" class="btn btn-secondary">Cancel</a>
        </form>
      </div>
      <script>
        function previewImage(input) {
          const preview = document.getElementById('imagePreview');
          if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
              preview.src = e.target.result;
              preview.style.display = 'block';
            };
            reader.readAsDataURL(input.files[0]);
          } else {
            preview.style.display = 'none';
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/incidents', requireAuth, upload.single('incidentImage'), async (req, res) => {
  try {
    const { title, type, priority, location, description, contact } = req.body;
    const incidents = await readData(INCIDENTS_FILE);
    
    let imagePath = null;
    let identifiedStudents = [];
    
    // If image is uploaded, process it for face recognition
    if (req.file) {
      imagePath = path.join('uploads', 'incidents', req.file.filename).replace(/\\/g, '/');
      
      // Perform face recognition to identify students
      const fullImagePath = path.join(INCIDENT_IMAGES_DIR, req.file.filename);
      identifiedStudents = await findMatchingStudents(fullImagePath);
    }
    
    const newIncident = {
      id: uuidv4(),
      title,
      type,
      priority,
      location,
      description,
      contact,
      reportedBy: req.session.username,
      status: 'open',
      imagePath: imagePath,
      identifiedStudents: identifiedStudents,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    incidents.push(newIncident);
    await writeData(INCIDENTS_FILE, incidents);
    
    res.redirect('/incidents');
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).send('Error creating incident. Please try again.');
  }
});

app.get('/incidents', requireAuth, async (req, res) => {
  const incidents = await readData(INCIDENTS_FILE);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Incidents - Campus Security Platform</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .nav { display: flex; justify-content: space-between; align-items: center; }
        .nav h1 { margin: 0; color: #333; }
        .nav a { color: #007bff; text-decoration: none; margin-left: 20px; }
        .nav a:hover { text-decoration: underline; }
        .incidents-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .incident-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .incident-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .incident-title { font-size: 1.2em; font-weight: bold; color: #333; margin: 0; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status.open { background: #ffebee; color: #c62828; }
        .status.investigating { background: #fff3e0; color: #ef6c00; }
        .status.resolved { background: #e8f5e8; color: #2e7d32; }
        .priority { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 10px; }
        .priority.critical { background: #ffebee; color: #c62828; }
        .priority.high { background: #fff3e0; color: #ef6c00; }
        .priority.medium { background: #e3f2fd; color: #1976d2; }
        .priority.low { background: #e8f5e8; color: #2e7d32; }
        .incident-details { color: #666; margin: 10px 0; }
        .incident-meta { font-size: 0.9em; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
        .btn { padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; margin-right: 10px; }
        .btn:hover { background: #0056b3; }
        .btn-secondary { background: #6c757d; }
        .btn-secondary:hover { background: #545b62; }
        .filter-bar { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .filter-bar select { padding: 8px; margin-right: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .identified-student { background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #ffc107; }
        .student-photo { width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 2px solid #ffc107; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="nav">
          <h1>Security Incidents</h1>
          <div>
            <a href="/incidents/new">Report New</a>
            <a href="/dashboard">Dashboard</a>
          </div>
        </div>
      </div>
      
      <div class="filter-bar">
        <select onchange="filterIncidents()">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
        </select>
        <select onchange="filterIncidents()">
          <option value="">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      
      <div class="incidents-container">
        ${incidents.length === 0 ? '<p>No incidents reported yet.</p>' : incidents.reverse().map(incident => `
          <div class="incident-card" data-status="${incident.status}" data-priority="${incident.priority}">
            <div class="incident-header">
              <h3 class="incident-title">${incident.title}</h3>
              <div>
                <span class="status ${incident.status}">${incident.status}</span>
                <span class="priority ${incident.priority}">${incident.priority}</span>
              </div>
            </div>
            <div class="incident-details">
              <p><strong>Type:</strong> ${incident.type.replace('-', ' ').toUpperCase()}</p>
              <p><strong>Location:</strong> ${incident.location}</p>
              <p><strong>Description:</strong> ${incident.description}</p>
              ${incident.imagePath ? `
                <div style="margin-top: 15px;">
                  <strong>Uploaded Image:</strong><br>
                  <img src="/${incident.imagePath}" alt="Incident Image" style="max-width: 400px; max-height: 400px; border: 1px solid #ddd; border-radius: 4px; margin-top: 10px;">
                </div>
              ` : ''}
              ${incident.identifiedStudents && incident.identifiedStudents.length > 0 ? `
                <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                  <strong style="color: #856404; display: block; margin-bottom: 10px;">🔍 Identified Students (Face Recognition Match):</strong>
                  ${incident.identifiedStudents.map(student => `
                    <div style="background: white; padding: 15px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #ddd;">
                      <div style="display: flex; gap: 15px; align-items: center;">
                        ${student.photo ? `
                          <img src="/${student.photo}" alt="${student.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 2px solid #ffc107;">
                        ` : ''}
                        <div style="flex: 1;">
                          <p style="margin: 0 0 5px 0;"><strong>Name:</strong> ${student.name}</p>
                          <p style="margin: 0 0 5px 0;"><strong>Student ID:</strong> ${student.studentId}</p>
                          <p style="margin: 0 0 5px 0;"><strong>Department:</strong> ${student.department}</p>
                          <p style="margin: 0 0 5px 0;"><strong>Email:</strong> ${student.email}</p>
                          <p style="margin: 0; color: #007bff; font-weight: bold;">Match Confidence: ${Math.round(student.matchConfidence * 100)}%</p>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
            <div class="incident-meta">
              <p><strong>Reported by:</strong> ${incident.reportedBy} | <strong>Contact:</strong> ${incident.contact}</p>
              <p><strong>Reported on:</strong> ${new Date(incident.createdAt).toLocaleString()}</p>
              ${req.session.userRole === 'admin' ? `
                <div style="margin-top: 10px;">
                  <a href="/incidents/${incident.id}/edit" class="btn">Update Status</a>
                  <a href="/incidents/${incident.id}" class="btn btn-secondary">View Details</a>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      
      <script>
        function filterIncidents() {
          const statusFilter = document.querySelector('select').value;
          const priorityFilter = document.querySelectorAll('select')[1].value;
          const cards = document.querySelectorAll('.incident-card');
          
          cards.forEach(card => {
            const status = card.dataset.status;
            const priority = card.dataset.priority;
            
            const statusMatch = !statusFilter || status === statusFilter;
            const priorityMatch = !priorityFilter || priority === priorityFilter;
            
            card.style.display = (statusMatch && priorityMatch) ? 'block' : 'none';
          });
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await readData(USERS_FILE);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>User Management - Campus Security Platform</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .nav { display: flex; justify-content: space-between; align-items: center; }
        .nav h1 { margin: 0; color: #333; }
        .nav a { color: #007bff; text-decoration: none; margin-left: 20px; }
        .nav a:hover { text-decoration: underline; }
        .users-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .user-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .user-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .user-name { font-size: 1.2em; font-weight: bold; color: #333; margin: 0; }
        .role { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .role.admin { background: #ffebee; color: #c62828; }
        .role.user { background: #e8f5e8; color: #2e7d32; }
        .user-details { color: #666; margin: 10px 0; }
        .user-meta { font-size: 0.9em; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
        .btn { padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; margin-right: 10px; }
        .btn:hover { background: #0056b3; }
        .btn-danger { background: #dc3545; }
        .btn-danger:hover { background: #c82333; }
        .add-user { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #555; font-weight: bold; }
        input[type="text"], input[type="email"], input[type="password"], input[type="file"], select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .btn-primary { background: #28a745; }
        .btn-primary:hover { background: #218838; }
        .photo-preview { margin-top: 10px; max-width: 200px; max-height: 200px; border: 2px solid #ddd; border-radius: 4px; display: none; }
        .file-info { margin-top: 5px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="nav">
          <h1>User Management</h1>
          <div>
            <a href="/dashboard">Dashboard</a>
          </div>
        </div>
      </div>
      
      <div class="add-user">
        <h3>Add New User</h3>
        <form method="POST" action="/users" enctype="multipart/form-data">
          <div class="form-group">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
          </div>
          <div class="form-group">
            <label for="name">Full Name:</label>
            <input type="text" id="name" name="name" required>
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
          </div>
          <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
          </div>
          <div class="form-group">
            <label for="userType">User Type:</label>
            <select id="userType" name="userType" required onchange="toggleStudentId()">
              <option value="">Select user type...</option>
              <option value="admin">Administrator</option>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div class="form-group">
            <label for="role">Role:</label>
            <select id="role" name="role" required>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-group" id="studentIdGroup" style="display: none;">
            <label for="studentId">Student ID:</label>
            <input type="text" id="studentId" name="studentId" placeholder="Enter student ID">
          </div>
          <div class="form-group">
            <label for="department">Department:</label>
            <input type="text" id="department" name="department" required placeholder="e.g., Computer Science">
          </div>
          <div class="form-group" id="photoGroup">
            <label for="registrationPhoto">Registration Photo (for face recognition):</label>
            <input type="file" id="registrationPhoto" name="registrationPhoto" accept="image/*" onchange="previewPhoto(this)">
            <div class="file-info">Upload a clear face photo for student identification (JPG, PNG, Max 10MB)</div>
            <img id="photoPreview" class="photo-preview" alt="Preview">
          </div>
          <button type="submit" class="btn btn-primary">Add User</button>
        </form>
      </div>
      
      <div class="users-container">
        <h3>System Users</h3>
        ${users.map(user => `
          <div class="user-card">
            <div class="user-header">
              <h3 class="user-name">${user.name}</h3>
              <span class="role ${user.role}">${user.role}</span>
            </div>
            <div class="user-details">
              ${user.registrationPhoto ? `
                <div style="margin-bottom: 15px;">
                  <img src="/${user.registrationPhoto}" alt="${user.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; border: 2px solid #007bff;">
                </div>
              ` : ''}
              <p><strong>Username:</strong> ${user.username}</p>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>User Type:</strong> ${user.userType}</p>
              <p><strong>Department:</strong> ${user.department}</p>
              ${user.studentId ? `<p><strong>Student ID:</strong> ${user.studentId}</p>` : ''}
              ${user.registrationPhoto ? `<p style="color: #28a745; font-weight: bold;">✓ Photo registered for face recognition</p>` : '<p style="color: #dc3545;">⚠ No photo uploaded</p>'}
            </div>
            <div class="user-meta">
              <p><strong>Created:</strong> ${new Date(user.createdAt).toLocaleString()}</p>
              <div style="margin-top: 10px;">
                <a href="/users/${user.id}/edit" class="btn">Edit</a>
                ${user.id !== req.session.userId ? `<a href="/users/${user.id}/delete" class="btn btn-danger" onclick="return confirm('Are you sure?')">Delete</a>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <script>
        function toggleStudentId() {
          const userType = document.getElementById('userType').value;
          const studentIdGroup = document.getElementById('studentIdGroup');
          const studentIdInput = document.getElementById('studentId');
          const photoGroup = document.getElementById('photoGroup');
          
          if (userType === 'student') {
            studentIdGroup.style.display = 'block';
            studentIdInput.required = true;
            photoGroup.style.display = 'block';
          } else {
            studentIdGroup.style.display = 'none';
            studentIdInput.required = false;
            studentIdInput.value = '';
            photoGroup.style.display = 'block';
          }
        }
        
        function previewPhoto(input) {
          const preview = document.getElementById('photoPreview');
          if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
              preview.src = e.target.result;
              preview.style.display = 'block';
            };
            reader.readAsDataURL(input.files[0]);
          } else {
            preview.style.display = 'none';
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/users', requireAuth, requireAdmin, upload.fields([
  { name: 'registrationPhoto', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const { username, name, email, password, role, userType, studentId, department } = req.body;
    const users = await readData(USERS_FILE);
    
    // Check if username already exists
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Handle photo uploads
    let registrationPhotoPath = null;
    let profilePhotoPath = null;
    
    if (req.files && req.files.registrationPhoto && req.files.registrationPhoto[0]) {
      registrationPhotoPath = path.join('uploads', 'photos', req.files.registrationPhoto[0].filename).replace(/\\/g, '/');
    }
    
    if (req.files && req.files.profilePhoto && req.files.profilePhoto[0]) {
      profilePhotoPath = path.join('uploads', 'photos', req.files.profilePhoto[0].filename).replace(/\\/g, '/');
    }
    
    const newUser = {
      id: uuidv4(),
      username,
      name,
      email,
      password: hashedPassword,
      role,
      userType,
      studentId: userType === 'student' ? studentId : null,
      department,
      profilePhoto: profilePhotoPath,
      registrationPhoto: registrationPhotoPath,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    await writeData(USERS_FILE, users);
    
    res.redirect('/users');
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).send('Error creating user. Please try again.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Campus Security Management Platform running on http://localhost:${PORT}`);
    console.log('Demo credentials: admin / admin123');
  });
}).catch(error => {
  console.error('Failed to start server:', error);
});
