import { createBrowserRouter } from "react-router";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Protected from "./features/auth/components/Protected";
import Home from "./features/interview/pages/Home";
import Interview from "./features/interview/pages/Interview";
import MockInterview from "./features/interview/pages/MockInterview";
import MockInterviewSummary from "./features/interview/pages/MockInterviewSummary";
import MockAnalytics from "./features/interview/components/MockAnalytics";

const AnalyticsPage = () => (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0f", padding: "3rem 1rem", fontFamily: "Inter, sans-serif" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1a1a2e", paddingBottom: "1rem", marginBottom: "2rem" }}>
                <h1 style={{ color: "#fff", fontSize: "1.8rem", margin: 0 }}>AI Interview Analytics</h1>
                <a href="/" style={{ color: "#e1034d", textDecoration: "none", fontSize: "0.85rem" }}>Back to Dashboard</a>
            </div>
            <MockAnalytics />
        </div>
    </div>
)

export const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/register",
        element: <Register />
    },
    {
        path: "/",
        element: <Protected><Home /></Protected>
    },
    {
        path:"/interview/:interviewId",
        element: <Protected><Interview /></Protected>
    },
    {
        path: "/mock/analytics",
        element: <Protected><AnalyticsPage /></Protected>
    },
    {
        path: "/mock/:id",
        element: <Protected><MockInterview /></Protected>
    },
    {
        path: "/mock/:id/summary",
        element: <Protected><MockInterviewSummary /></Protected>
    }
])