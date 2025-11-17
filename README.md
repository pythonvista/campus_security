# Campus Security Management Platform (CSMP)

A minimalistic Express.js web application for campus security management, designed based on the thesis proposal requirements.

**Institution:** Bamidele Olumilua University of Education, Science and Technology  
**Project by:** Fagbuaro Babatunde Michael (Matric No: 2789)  
**Department:** Computer Science

## Features

- **Multi-User Authentication**: Separate login portals for Admin, Student, and Staff
- **Role-Based Access Control**: Different permissions and interfaces based on user type
- **Incident Reporting**: Easy-to-use form for reporting security incidents with image upload
- **Face Recognition & Student Identification**: Automatically identify students from uploaded incident photos by matching faces with registration photos
- **Incident Management**: View, filter, and track incident status with photo evidence
- **User Management**: Admin panel for managing system users with student/staff roles and photo registration
- **Real-time Dashboard**: Overview of security statistics and recent incidents
- **JSON Database**: File-based storage using JSON files (no external database required)
- **Student ID Tracking**: Automatic student ID management for student users
- **Photo Registration**: Upload registration photos for face recognition and identification

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   npm start
   ```

3. **Access the application:**
   - Open your browser and go to `http://localhost:3000`
   - Login with demo credentials:
     - **Admin:** `admin` / `admin123`
     - **Student:** `student001` / `student123` (Fagbuaro Babatunde Michael)
     - **Staff:** `staff001` / `staff123` (Dr. John Smith)

## Project Structure

```
├── app.js              # Main Express application
├── package.json        # Project dependencies and scripts
├── data/              # JSON database files (auto-created)
│   ├── users.json     # User accounts and authentication data
│   ├── incidents.json # Security incident reports
│   └── alerts.json    # System alerts and notifications
├── uploads/           # Uploaded files (auto-created)
│   ├── photos/        # User registration photos
│   └── incidents/     # Incident scene photos
└── README.md          # This file
```

## Core Functionality

### Authentication System
- Session-based authentication
- Password hashing with bcrypt
- Multi-user type support (Admin/Student/Staff)
- Role-based access control with user type validation
- Student ID tracking for student users

### Incident Management
- **Report Incidents**: Students and staff can report security incidents with photo evidence
- **Incident Types**: Theft, vandalism, unauthorized access, violence, emergency, suspicious activity, dress code violation, other
- **Priority Levels**: Low, Medium, High, Critical
- **Status Tracking**: Open, Investigating, Resolved
- **Location Tracking**: Building, room, or area specification
- **Photo Upload**: Upload images of incident scenes or persons involved
- **Automatic Student Identification**: Face recognition automatically identifies students from uploaded photos by matching with registration photos
- **Registration Info Display**: Shows identified student's registration information including name, ID, department, and email

### User Management (Admin Only)
- Add new users to the system with user type selection
- Assign roles (Admin/User) and user types (Admin/Student/Staff)
- Manage user accounts with department and student ID tracking
- Upload registration photos for face recognition (especially important for students)
- View user activity, profile information, and registration photos

### Dashboard Features
- Real-time statistics
- Recent incident overview
- Quick action buttons
- Status-based filtering

## API Endpoints

### Authentication
- `GET /login` - Login page
- `POST /login` - Authenticate user
- `GET /logout` - Logout user

### Dashboard
- `GET /dashboard` - Main dashboard (requires authentication)

### Incidents
- `GET /incidents` - View all incidents
- `GET /incidents/new` - Report new incident form
- `POST /incidents` - Submit new incident

### User Management (Admin Only)
- `GET /users` - User management page
- `POST /users` - Add new user

## Database Schema

### Users (`data/users.json`)
```json
{
  "id": "uuid",
  "username": "string",
  "password": "hashed_password",
  "role": "admin|user",
  "userType": "admin|student|staff",
  "name": "string",
  "email": "string",
  "studentId": "string|null",
  "department": "string",
  "createdAt": "ISO_date"
}
```

### Incidents (`data/incidents.json`)
```json
{
  "id": "uuid",
  "title": "string",
  "type": "theft|vandalism|unauthorized-access|violence|emergency|suspicious-activity|other",
  "priority": "low|medium|high|critical",
  "location": "string",
  "description": "string",
  "contact": "string",
  "reportedBy": "username",
  "status": "open|investigating|resolved",
  "createdAt": "ISO_date",
  "updatedAt": "ISO_date"
}
```

## Security Features

- Password hashing with bcrypt
- Session management
- Role-based access control
- Input validation
- SQL injection prevention (using JSON files)
- Image upload validation (file type and size restrictions)
- Secure file storage with organized directory structure

## Face Recognition Feature

The platform now includes automatic student identification through face recognition:

1. **Photo Registration**: When creating student accounts, administrators can upload registration photos that serve as reference images for face matching.

2. **Incident Photo Upload**: When reporting an incident, users can upload photos of the scene or persons involved.

3. **Automatic Identification**: The system automatically matches faces in uploaded incident photos against registered student photos and identifies potential matches.

4. **Registration Info Display**: For each identified student, the system displays:
   - Full name
   - Student ID
   - Department
   - Email address
   - Registration photo
   - Match confidence percentage

5. **Security Personnel Assistance**: This feature helps security personnel quickly identify individuals involved in incidents, especially useful for dress code violations, unauthorized access, or other security concerns.

**Note**: The current implementation uses a simplified matching algorithm. For production use, consider integrating professional face recognition APIs (such as AWS Rekognition, Azure Face API, or face-api.js library) for more accurate results.

## Development

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon for automatic server restarts on file changes.

### Adding New Features
The application is designed to be easily extensible. Key areas for enhancement:
- Mobile app integration
- Real-time notifications
- Advanced reporting and analytics
- Integration with external security systems
- Biometric authentication support

## Technology Stack

- **Backend**: Node.js, Express.js
- **Authentication**: Express-session, bcryptjs
- **Database**: JSON files (file-based storage)
- **Frontend**: HTML, CSS, JavaScript (server-side rendered)
- **Utilities**: UUID for unique identifiers
- **File Upload**: Multer for handling multipart/form-data
- **Image Processing**: Sharp for image optimization and thumbnail generation

## Future Enhancements

Based on the thesis proposal, potential future features include:
- Mobile application development
- Biometric/RFID access control integration
- AI-powered threat detection
- Real-time alert system
- Advanced analytics and reporting
- Integration with campus surveillance systems

## License

MIT License - Feel free to use this project for educational or research purposes.

## Contributing

This is a minimalistic implementation designed for demonstration and educational purposes. Feel free to extend and modify according to your specific requirements.
# campus_security
