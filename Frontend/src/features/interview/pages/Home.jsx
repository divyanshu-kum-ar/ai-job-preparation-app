import React, { useState, useEffect, useRef } from "react";
import "../style/home.scss";
import { useInterview } from "../hooks/useInterview.js";
import { useNavigate } from "react-router";

const LoadingScreen = () => {
    const [msg, setMsg] = useState("Parsing Resume...");

    useEffect(() => {
        const messages = [
            "Parsing Resume...",
            "Analyzing Skills...",
            "Generating Interview Strategy...",
            "Creating Personalized Plan..."
        ];
        let index = 0;
        const interval = setInterval(() => {
            index = (index + 1) % messages.length;
            setMsg(messages[index]);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="loading-screen" aria-live="polite">
            <div className="loader-container">
                <div className="spinner" aria-hidden="true"></div>
                <h1>{msg}</h1>
            </div>
        </main>
    );
};

const Home = () => {
    const { loading, generateReport, reports } = useInterview();

    const [jobDescription, setJobDescription] = useState("");
    const [selfDescription, setSelfDescription] = useState("");
    const [title, setTitle] = useState("");

    const resumeInputRef = useRef(null);
    const navigate = useNavigate();

    const handleGenerateReport = async () => {
        try {
            if (!title.trim()) {
                alert("Please enter a Job Title");
                return;
            }

            if (!jobDescription.trim()) {
                alert("Please enter a Job Description");
                return;
            }

            const resumeFile = resumeInputRef.current?.files?.[0];

            if (!resumeFile && !selfDescription.trim()) {
                alert(
                    "Please upload a Resume or provide a Self Description"
                );
                return;
            }

            const data = await generateReport({
                jobDescription,
                selfDescription,
                resumeFile,
                title,
            });

            if (!data) {
                alert("Unable to generate report. Please try again.");
                return;
            }

            if (!data._id) {
                console.error("Invalid API Response:", data);
                alert("Unable to generate report. Please try again.");
                return;
            }

            navigate(`/interview/${data._id}`);
        } catch (error) {
            console.error("Generate Report Error:", error);
            alert("Unable to generate report. Please try again.");
        }
    };

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="home-page">
            <header className="page-header">
                <h1>
                    Create Your Custom{" "}
                    <span className="highlight">
                        Interview Plan
                    </span>
                </h1>
                <p>
                    Let our AI analyze the job requirements and your unique
                    profile to build a winning strategy.
                </p>
            </header>

            <div className="interview-card">
                {/* Job Title - Full Width */}
                <div className="title-input-section">
                    <label
                        className="section-label"
                        htmlFor="title"
                    >
                        Job Title
                        <span className="badge badge--required">
                            Required
                        </span>
                    </label>

                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={title}
                        onChange={(e) =>
                            setTitle(e.target.value)
                        }
                        className="title-input"
                        placeholder="e.g. Java Backend Developer"
                        aria-required="true"
                        aria-label="Job Title"
                    />
                </div>

                <div className="interview-card__body">
                    {/* Left Panel */}
                    <div className="panel panel--left">
                        <div className="panel__header">
                            <h2>Target Job Description</h2>
                            <span className="badge badge--required">
                                Required
                            </span>
                        </div>

                        <textarea
                            value={jobDescription}
                            onChange={(e) =>
                                setJobDescription(e.target.value)
                            }
                            className="panel__textarea"
                            placeholder="Paste the complete job description here..."
                            maxLength={5000}
                            aria-required="true"
                            aria-label="Job Description"
                        />

                        <div className="char-counter">
                            {jobDescription.length} / 5000 chars
                        </div>
                    </div>

                    <div className="panel-divider"></div>

                    {/* Right Panel */}
                    <div className="panel panel--right">
                        <div className="panel__header">
                            <h2>Your Profile</h2>
                        </div>

                        {/* Resume Upload */}
                        <div className="upload-section">
                            <label className="section-label">
                                Upload Resume
                                <span className="badge badge--best">
                                    Best Results
                                </span>
                            </label>

                            <label
                                className="dropzone"
                                htmlFor="resume"
                                tabIndex="0"
                                role="button"
                                aria-label="Upload Resume PDF or DOCX (Max 5MB)"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        resumeInputRef.current?.click();
                                    }
                                }}
                            >
                                <p className="dropzone__title">
                                    Click to upload or drag & drop
                                </p>

                                <p className="dropzone__subtitle">
                                    PDF or DOCX (Max 5MB)
                                </p>

                                <input
                                    ref={resumeInputRef}
                                    hidden
                                    type="file"
                                    id="resume"
                                    name="resume"
                                    accept=".pdf,.docx"
                                    aria-label="Resume File Upload"
                                />
                            </label>
                        </div>

                        <div className="or-divider">
                            <span>OR</span>
                        </div>

                        {/* Self Description */}
                        <div className="self-description">
                            <label
                                className="section-label"
                                htmlFor="selfDescription"
                            >
                                Quick Self Description
                            </label>

                            <textarea
                                value={selfDescription}
                                onChange={(e) =>
                                    setSelfDescription(e.target.value)
                                }
                                id="selfDescription"
                                name="selfDescription"
                                className="panel__textarea panel__textarea--short"
                                placeholder="Tell us about your skills, projects, and experience..."
                                aria-label="Quick Self Description"
                            />
                        </div>

                        <div className="info-box">
                            <p>
                                Either a <strong>Resume</strong> or a{" "}
                                <strong>Self Description</strong> is required
                                to generate a personalized plan.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="interview-card__footer">
                    <span className="footer-info">
                        AI-Powered Strategy Generation • Approx 30s
                    </span>

                    <button
                        onClick={handleGenerateReport}
                        className="generate-btn"
                        disabled={loading}
                        aria-label="Generate My Interview Strategy"
                    >
                        {loading
                            ? "Generating..."
                            : "Generate My Interview Strategy"}
                    </button>
                </div>
            </div>

            <section className="recent-reports">
                <h2>My Recent Interview Plans</h2>

                {reports && reports.length > 0 ? (
                    <ul className="reports-list">
                        {reports.map((report) => (
                            <li
                                key={report._id}
                                className="report-item"
                                tabIndex="0"
                                role="button"
                                aria-label={`View plan for ${report.title || "Untitled Position"}`}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        navigate(`/interview/${report._id}`);
                                    }
                                }}
                                onClick={() =>
                                    navigate(
                                        `/interview/${report._id}`
                                    )
                                }
                            >
                                <h3>
                                    {report.title ||
                                        "Untitled Position"}
                                </h3>

                                <p className="report-meta">
                                    Generated on{" "}
                                    {new Date(
                                        report.createdAt
                                    ).toLocaleDateString()}
                                </p>

                                <p className="match-score">
                                    Match Score:{" "}
                                    {report.matchScore || 0}%
                                </p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="empty-state-history">
                        <p className="empty-text">No interview plans yet.</p>
                        <p className="empty-subtext">Generate your first interview strategy.</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default Home;