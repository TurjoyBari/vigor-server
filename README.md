# VIGOR Server

Backend API for **VIGOR**, a full-stack Fitness & Gym Management Platform.
This server handles authentication, role-based access control, class management, forum management, payments, and all database operations.

---



## Project Overview

VIGOR Server powers the backend infrastructure for the VIGOR Fitness platform.

It provides secure REST APIs for:

* Authentication
* User management
* Trainer management
* Fitness class management
* Forum system
* Payment processing
* Admin moderation
* Dashboard analytics

---

## Core Features

### Authentication & Authorization

* JWT-based authentication
* Protected routes
* Role-based access control
* Better Auth integration
* Admin-only APIs
* Trainer-only APIs

### User Features

* Register / Login
* Favorite classes
* Book fitness classes
* Apply as trainer
* Dashboard statistics

### Trainer Features

* Add classes
* Update/Delete classes
* View enrolled students
* Create forum posts
* Manage own posts

### Admin Features

* Manage users
* Block / Unblock users
* Promote users to admin
* Approve / Reject trainer applications
* Approve / Reject classes
* Manage trainers
* Moderate forum posts
* View transactions

### Payments

* Stripe payment integration
* Payment intent creation
* Booking persistence
* Transaction history

---

## Tech Stack

| Category       | Technology        |
| -------------- | ----------------- |
| Runtime        | Node.js           |
| Framework      | Express.js        |
| Database       | MongoDB           |
| Authentication | JWT / Better Auth |
| Payment        | Stripe            |
| Security       | CORS, dotenv      |

---

## API Architecture

RESTful API architecture with modular route handling.

Example resource groups:

* `/auth`
* `/users`
* `/classes`
* `/bookings`
* `/favorites`
* `/trainer-applications`
* `/forum-posts`
* `/payments`
* `/admin`

---

## Project Structure

```bash
vigor-server/
│
├── index.js
├── package.json
├── .env
├── middleware/
├── routes/
├── utils/
└── controllers/
```

---

## Installation

Clone repository:

```bash
git clone YOUR_SERVER_REPO_URL
```

Go to project folder:

```bash
cd vigor-server
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Or:

```bash
node index.js
```

---

## Environment Variables

Create `.env`

```env
PORT=5000
MONGODB_URI=
JWT_SECRET=
STRIPE_SECRET_KEY=
BETTER_AUTH_SECRET=
CLIENT_URL=
IMGBB_API_KEY=
```

---

## Available Scripts

```bash
npm run dev
npm start
```

---

## Database Collections

Main MongoDB collections:

* users
* classes
* bookings
* favorites
* trainerApplications
* forumPosts
* payments
* comments

---

## API Functionalities

### Search

Class search uses MongoDB `$regex`

Example:

```js
{
  className: {
    $regex: searchTerm,
    $options: "i"
  }
}
```

### Filter

Category filtering uses MongoDB `$in`

Example:

```js
{
  category: {
    $in: ["Yoga", "Cardio"]
  }
}
```

### Pagination

Pagination uses:

* skip
* limit

Example:

```js
const skip = (page - 1) * limit;
```

---

## Security Features

### Soft Block System

Blocked users can still:

* Login
* Browse classes
* View forum posts

Blocked users cannot:

* Book classes
* Apply as trainer
* Comment
* Like/dislike forum posts
* Modify state-changing resources

### Route Protection

Protected middleware:

* verifyToken
* verifyAdmin
* verifyTrainer
* checkUserBlocked

---

## API Response Example

Success:

```json
{
  "success": true,
  "message": "Operation successful"
}
```

Error:

```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

---

## Deployment

Recommended platforms:

Backend Hosting:

* [Render](https://render.com?utm_source=chatgpt.com)
* [Railway](https://railway.com?utm_source=chatgpt.com)
* VPS

Database:

* [MongoDB Atlas](https://www.mongodb.com/atlas?utm_source=chatgpt.com)

---

## Future Improvements

Planned enhancements:

* WebSocket notifications
* Email service
* Analytics improvements
* Rate limiting
* API documentation
* Logging system
* Unit testing

---

## Author

**Rafiul Bari Turjo**

