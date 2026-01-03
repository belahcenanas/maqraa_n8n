# Student Manager Application

A modern, mobile-friendly React application for managing student reports, tracking statistics, and monitoring group performance in a Quranic learning environment. Built with Vite, TypeScript, and Supabase.

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Native CSS (responsive, light/dark themes, glassmorphism)
- **Database**: Supabase (PostgreSQL)
- **Visualization**: Recharts
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1.  **Clone the repository** (if applicable) or navigate to the project directory.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Setup**:
    Ensure you have a `.env` file in the root directory with your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```
4.  **Run the development server**:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

## Project Structure

```
student-manager/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Main application pages
│   │   ├── Stats.tsx   # Statistics & Analytics module
│   │   └── ...
│   ├── lib/            # Utilities & Supabase configuration
│   ├── assets/         # Static assets
│   ├── App.tsx         # Main application component & Routing
│   └── main.tsx        # Entry point
├── public/             # Static public assets
└── ...
```

## Features

- **Student Management**: Add, edit, and manage student profiles.
- **Reporting**: Track daily study sessions and progress.
- **Group Management**: Organize students into groups and monitor collective performance.

---

## Statistics Engine (`/stats`)

The **Stats** module is a powerful analytics dashboard designed to give insights into student performance and engagement.

### Navigation & Views

The dashboard is divided into four main tabs:

1.  **Overview**:
    - **Key Metrics**: Total study duration, number of reports, missed sessions, and average completion rate.
    - **Top Performers**: Bar chart highlighting students with the most study hours.
    - **Report Methods**: Breakdown of how reports are submitted (e.g., Voice, Text).

2.  **Trends**:
    - **Daily Activity**: Line chart showing the volume of reports and study duration over the last 14 days.
    - **Intensity by Weekday**: Heatmap-style bar chart showing which days are most active.
    - **Hourly Reporting**: Distribution of when reports are submitted during the day.

3.  **Groups**:
    - **Performance Comparison**: Side-by-side cards comparing groups on total time, student count, and average session duration.
    - **Market Share**: Pie chart visualizing the contribution of each group to the total study time.

4.  **Consistency**:
    - **Leaderboard**: Detailed table of student completion rates and session counts.
    - **Streaks**: Tracks consecutive days of reporting to encourage habit building. Highlights current active streaks.

### Filtering

- **Time Period**: Filter data by *Today*, *This Week*, *This Month*, *This Year*, or *All Time*.
- **Group Filter**: Use the dropdown in the header to view statistics for a specific group or all groups combined.
