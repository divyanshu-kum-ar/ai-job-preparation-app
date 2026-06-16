import React, { useState, useRef } from "react";
import "../style/home.scss";
import { useInterview } from "../hooks/useInterview.js";
import { useNavigate } from "react-router";

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
                alert("Failed to generate interview report.");
                return;
            }

            if (!data._id) {
                console.error("Invalid API Response:", data);
                alert("Server returned invalid response.");
                return;
            }

            navigate(`/interview/${data._id}`);
        } catch (error) {
            console.error("Generate Report Error:", error);

            const errorMessage =
                error?.response?.data?.message ||
                error?.message ||
                "Something went wrong.";

            alert(errorMessage);
        }
    };

    if (loading) {
        return (
            <main className="loading-screen">
                <h1>Loading your interview plan...</h1>
            </main>
        );
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
                <div className="interview-card__body">

                    {/* Job Title */}
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
                        />
                    </div>

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
                                    accept=".pdf,.doc,.docx"
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
                    >
                        {loading
                            ? "Generating..."
                            : "Generate My Interview Strategy"}
                    </button>
                </div>
            </div>

            {reports?.length > 0 && (
                <section className="recent-reports">
                    <h2>My Recent Interview Plans</h2>

                    <ul className="reports-list">
                        {reports.map((report) => (
                            <li
                                key={report._id}
                                className="report-item"
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
                </section>
            )}
        </div>
    );
};

export default Home;