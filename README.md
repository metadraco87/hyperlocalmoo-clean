# HyperlocalMoo

A clean SvelteKit frontend for connecting local communities with Google OAuth authentication and post feed functionality. Ready for Vercel deployment.

![HyperlocalMoo Homepage](https://github.com/user-attachments/assets/c0a8f3c6-80d5-4622-b6b4-cfeacd4b51f4)

## Features

- ✅ **Google OAuth Authentication** - Secure login with Google accounts
- ✅ **Local Post Feed** - Share updates, ask questions, and connect with neighbors
- ✅ **Post Creation** - Create posts with optional location tags
- ✅ **Responsive Design** - Mobile-friendly with TailwindCSS
- ✅ **TypeScript Support** - Full type safety throughout the application
- ✅ **SQLite Database** - Local database with Drizzle ORM for development
- ✅ **Vercel Ready** - Configured for seamless Vercel deployment

## Tech Stack

- **Framework**: SvelteKit with TypeScript
- **Styling**: TailwindCSS with typography and forms plugins
- **Authentication**: Google OAuth with Arctic OAuth library
- **Database**: SQLite with Drizzle ORM (libSQL for serverless)
- **Deployment**: Vercel adapter
- **Development**: ESLint, Prettier, and Vite

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google OAuth credentials

### 1. Clone and Install

```bash
git clone <repository-url>
cd hyperlocalmoo-clean
npm install
```

### 2. Environment Setup

Copy the environment file and fill in your Google OAuth credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=file:local.db
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
AUTH_SECRET=your_random_auth_secret_here
```

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:5173/auth/callback/google`
6. Copy Client ID and Client Secret to your `.env` file

### 4. Database Setup

```bash
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) to see the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Run TypeScript checks
- `npm run lint` - Run ESLint and Prettier checks
- `npm run format` - Format code with Prettier
- `npm run db:push` - Push database schema changes
- `npm run db:generate` - Generate database migrations
- `npm run db:studio` - Open Drizzle Studio

## Deployment

### Vercel Deployment

This app is configured for Vercel deployment:

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Update Google OAuth redirect URI to your production domain
4. Deploy!

### Environment Variables for Production

Make sure to set these in your deployment platform:

```env
DATABASE_URL=your_production_database_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
AUTH_SECRET=your_secure_random_string
```

## Project Structure

```
src/
├── lib/
│   ├── components/        # Reusable Svelte components
│   └── server/           # Server-side utilities
│       ├── auth.ts       # Authentication logic
│       ├── oauth.ts      # Google OAuth configuration
│       └── db/           # Database schema and connection
├── routes/
│   ├── auth/             # Authentication routes
│   ├── feed/             # Post feed page
│   ├── create/           # Post creation page
│   └── +layout.svelte    # Main layout
└── app.html              # HTML template
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is ready for production use and deployment.
