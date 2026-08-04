# BMU CBT Frontend

Modern Next.js frontend for Bayelsa Medical University Computer-Based Testing System.

## 🚀 Features

- **Modern UI/UX** with Tailwind CSS and Lucide icons
- **JWT Authentication** with secure token management
- **Responsive Design** for all devices
- **Real-time Exam Taking** interface
- **Results Dashboard** with analytics
- **Profile Management** system
- **CSV Export** functionality

## 🛠️ Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Modern styling
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client
- **React Hook Form** - Form handling
- **React Hot Toast** - Notifications

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Backend API running on `http://127.0.0.1:8000/api`

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/             # Reusable components
│   ├── auth/              # Authentication components
│   ├── dashboard/         # Dashboard components
│   └── ui/               # UI components
├── contexts/              # React contexts
│   └── AuthContext.tsx    # Authentication context
└── utils/                 # Utility functions
```

## 🔐 Authentication

The frontend uses JWT tokens for authentication:

- **Login:** `POST /api/auth/login/`
- **Profile:** `GET /api/auth/profile/`
- **Logout:** Clears local tokens

## 📊 Features Overview

### 🏠 Dashboard
- Overview statistics
- Recent exam results
- Upcoming exams
- Performance charts

### 📝 Exams
- Browse available exams
- Filter by status
- Start exams
- Real-time progress

### 📈 Results
- View exam history
- Performance analytics
- Download CSV reports
- Grade breakdowns

### 👤 Profile
- Personal information
- Account settings
- Academic details

## 🎨 Design System

### Colors
- **Primary:** Blue (#3b82f6)
- **Success:** Green (#22c55e)
- **Warning:** Orange (#f59e0b)
- **Error:** Red (#ef4444)

### Components
- **Buttons:** Consistent styling with hover states
- **Cards:** Clean, modern card layouts
- **Forms:** Accessible form inputs
- **Navigation:** Responsive sidebar

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

## 📱 Responsive Design

- **Mobile:** 320px and up
- **Tablet:** 768px and up  
- **Desktop:** 1024px and up

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm run start
```

### Environment Setup

1. Set `NEXT_PUBLIC_API_URL` to your production API
2. Configure CORS on the backend
3. Deploy to Vercel, Netlify, or any Node.js hosting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please contact the BMU IT department or create an issue in the repository.

---

**Built with ❤️ for Bayelsa Medical University**
