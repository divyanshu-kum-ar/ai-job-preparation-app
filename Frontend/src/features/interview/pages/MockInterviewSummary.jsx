import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { getMockInterview, deleteMockInterview, practiceWeakAreas } from '../services/mock.api'
import '../style/interview.scss'

const MockInterviewSummary = () => {
    const { id } = useParams()
    const navigate = useNavigate()

    const [mockInterview, setMockInterview] = useState(null)
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [practicing, setPracticing] = useState(false)
    const [error, setError] = useState(null)

    // Filters and Modals
    const [questionFilter, setQuestionFilter] = useState("all") // "all", "technical", "behavioral", "strong", "weak"
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    const fetchDetails = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await getMockInterview(id)
            if (data && data.mockInterview) {
                setMockInterview(data.mockInterview)
            }
        } catch (err) {
            console.error(err)
            setError(err.response?.data?.message || "Failed to load mock interview report.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDetails()
    }, [id])

    const handleDelete = async () => {
        setDeleting(true)
        setShowDeleteModal(false)
        try {
            await deleteMockInterview(id)
            // Navigate back to the strategy report or home page
            if (mockInterview?.report?._id) {
                navigate(`/interview/${mockInterview.report._id}`)
            } else {
                navigate("/")
            }
        } catch (err) {
            console.error(err)
            alert(err.response?.data?.message || "Failed to delete mock interview.")
        } finally {
            setDeleting(false)
        }
    }

    const handlePracticeWeakAreas = async () => {
        setPracticing(true)
        try {
            const data = await practiceWeakAreas(id)
            if (data && data.mockInterview) {
                navigate(`/mock/${data.mockInterview._id}`)
            }
        } catch (err) {
            console.error("Failed to generate practice session:", err)
            alert(err.response?.data?.message || "Failed to launch weak areas practice. Please try again.")
        } finally {
            setPracticing(false)
        }
    }

    const handleDownloadPDF = () => {
        const originalTitle = document.title
        const dateSuffix = mockInterview?.completedAt
            ? new Date(mockInterview.completedAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
        
        document.title = `Mock_Interview_Report_${dateSuffix}`
        window.print()
        document.title = originalTitle
    }

    const formattedTime = (secs) => {
        if (!secs) return "0s"
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return m > 0 ? `${m}m ${s}s` : `${s}s`
    }

    if (loading || deleting || practicing) {
        return (
            <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d15', color: '#fff', gap: '1.5rem' }}>
                <div className="spinner" style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #e1034d', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '500', color: '#aaa', margin: 0 }}>
                    {deleting ? "Deleting Mock Interview..." : practicing ? "Generating Practice Session for Weak Areas..." : "Loading Report Card..."}
                </h2>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </main>
        )
    }

    if (error) {
        return (
            <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d15', color: '#fff', padding: '2rem', textAlign: 'center' }}>
                <h1 style={{ color: '#e1034d', fontSize: '1.8rem', marginBottom: '1rem' }}>Report Error</h1>
                <p style={{ color: '#aaa', marginBottom: '2rem' }}>{error}</p>
                <button onClick={() => navigate(-1)} className="button secondary-button">Go Back</button>
            </main>
        )
    }

    const {
        score = 0,
        technicalAccuracy = 0,
        completeness = 0,
        clarity = 0,
        relevance = 0,
        strengths = [],
        weaknesses = [],
        recommendation = [],
        questions = [],
        answers = [],
        evaluations = [],
        starScores = [],
        studyPlan = [],
        companyMode = "Generic",
        difficulty = "Medium",
        experienceLevel = "1-2 Years",
        averageResponseTime = 0,
        timePerQuestion = [],
        user = {},
        completedAt
    } = mockInterview || {}

    // Dynamic metadata fields calculations
    const candidateName = user?.username || "Candidate"
    const totalQuestions = questions.length
    const totalTimeTaken = timePerQuestion.reduce((sum, current) => sum + (current || 0), 0)

    // Compute average behavioral STAR score percentage
    let totalStarPct = 0
    let starCount = 0
    starScores.forEach(star => {
        if (star && (star.situation || star.task || star.action || star.result)) {
            const sum = (star.situation || 0) + (star.task || 0) + (star.action || 0) + (star.result || 0)
            totalStarPct += (sum / 40) * 100
            starCount++
        }
    })
    const aggregateStarScore = starCount > 0 ? Math.round(totalStarPct / starCount) : 0

    // Filter Logic for log display
    const filteredQuestions = questions.map((q, idx) => ({
        q,
        idx,
        evalObj: evaluations[idx],
        ans: answers[idx]
    })).filter(({ q, idx, evalObj }) => {
        if (questionFilter === "all") return true
        
        // Technical questions indices are strictly < total questions count - behavioral count (3)
        // Or if questions length is 5 (weak practice), all of them are technical
        const isTechnical = questions.length === 5 ? true : idx < (questions.length - 3)
        
        if (questionFilter === "technical") return isTechnical
        if (questionFilter === "behavioral") return !isTechnical
        if (questionFilter === "strong") return evalObj && evalObj.score >= 8
        if (questionFilter === "weak") return evalObj && evalObj.score < 6
        return true
    })

    return (
        <div className="print-container" style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '3rem 1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                
                {/* Header Action Row */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a2e', paddingBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <span style={{ fontSize: '0.8rem', color: '#e1034d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Performance Report</span>
                        <h1 style={{ fontSize: '1.8rem', margin: '0.2rem 0 0 0', color: '#fff' }}>Mock Interview Intelligence</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleDownloadPDF}
                            className="button primary-button"
                            style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                        >
                            Download Report (PDF)
                        </button>
                        <button
                            onClick={() => navigate(`/interview/${mockInterview?.report?._id}`)}
                            className="button secondary-button"
                            style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                        >
                            Back to Strategy
                        </button>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="button secondary-button"
                            style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', color: '#ff2d78', borderColor: 'rgba(255,45,120,0.3)' }}
                        >
                            Delete Record
                        </button>
                    </div>
                </div>

                {/* Print Title (Hidden in browser, visible on print) */}
                <div className="print-only" style={{ display: 'none', borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '2.5rem', color: '#000', margin: 0 }}>AI Mock Interview Report</h1>
                    <p style={{ fontSize: '0.95rem', color: '#333', margin: '0.4rem 0 0 0', fontWeight: '600' }}>
                        Candidate Name: {candidateName} | Target Role: {mockInterview?.report?.title}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#555', margin: '0.2rem 0 0 0' }}>
                        Company Target: {companyMode} | Difficulty: {difficulty} | Date: {completedAt ? new Date(completedAt).toLocaleDateString() : 'N/A'}
                    </p>
                </div>

                {/* Interview Metadata Card */}
                <div style={{
                    backgroundColor: '#111120',
                    border: '1px solid #1c1c3a',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#ccc', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a1a2e', paddingBottom: '0.5rem' }}>
                        Interview Metadata
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                        fontSize: '0.85rem'
                    }}>
                        <div>Candidate Name: <strong style={{ color: '#fff' }}>{candidateName}</strong></div>
                        <div>Target Role: <strong style={{ color: '#fff' }}>{mockInterview?.report?.title || "Target Role"}</strong></div>
                        <div>Company Style: <strong style={{ color: '#fff' }}>{companyMode}</strong></div>
                        <div>Difficulty Level: <strong style={{ color: '#fff' }}>{difficulty}</strong></div>
                        <div>Date Attempted: <strong style={{ color: '#fff' }}>{completedAt ? new Date(completedAt).toLocaleDateString() : 'N/A'}</strong></div>
                        <div>Total Questions: <strong style={{ color: '#fff' }}>{totalQuestions}</strong></div>
                        <div>Total Time Taken: <strong style={{ color: '#fff' }}>{formattedTime(totalTimeTaken)}</strong></div>
                        <div>Average Time per Question: <strong style={{ color: '#fff' }}>{formattedTime(averageResponseTime)}</strong></div>
                    </div>
                </div>

                {/* Score Summary Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    
                    {/* Overall Score Circle Card */}
                    <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1.2rem', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.05rem', color: '#aaa', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Overall Score</h3>
                        <div style={{
                            width: '130px',
                            height: '130px',
                            borderRadius: '50%',
                            border: '4px solid #e1034d',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(225, 3, 77, 0.05)',
                            boxShadow: '0 0 20px rgba(225, 3, 77, 0.2)'
                        }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff' }}>{score}</span>
                            <span style={{ fontSize: '0.85rem', color: '#aaa' }}>/ 100</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#ccc', margin: 0, lineHeight: '1.4' }}>
                            {score >= 80 ? "Exceeded target expectations. Great work!" : score >= 60 ? "Solid match. Review minor gaps to improve further." : "Opportunity to revise weak topics."}
                        </p>
                    </div>

                    {/* Metric Benchmarks */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                        {[
                            { label: "Technical Accuracy", val: technicalAccuracy, color: "#3b82f6" },
                            { label: "Completeness", val: completeness, color: "#10b981" },
                            { label: "Clarity", val: clarity, color: "#8b5cf6" },
                            { label: "Relevance", val: relevance, color: "#f59e0b" },
                            ...(aggregateStarScore > 0 ? [{ label: "STAR Behavioral Score", val: aggregateStarScore, color: "#ff2d78" }] : [])
                        ].map((m, i) => (
                            <div key={i} style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span style={{ color: '#aaa' }}>{m.label}</span>
                                    <strong style={{ color: '#fff' }}>{m.val}%</strong>
                                </div>
                                <div style={{ width: '100%', height: '5px', backgroundColor: '#1a1a2e', borderRadius: '2.5px', overflow: 'hidden' }}>
                                    <div style={{ width: `${m.val}%`, height: '100%', backgroundColor: m.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Strong & Weak Areas lists */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    
                    {/* Strong Areas */}
                    <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#fff', fontWeight: '600' }}>Strong Areas</h3>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#ccc', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {strengths.length === 0 ? (
                                <li style={{ listStyleType: 'none', color: '#888', fontStyle: 'italic', paddingLeft: 0, marginLeft: '-1.2rem' }}>No strengths noted.</li>
                            ) : (
                                strengths.map((item, idx) => <li key={idx}>{item}</li>)
                            )}
                        </ul>
                    </div>

                    {/* Weak Areas - With Practice Weak Areas Action trigger */}
                    <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff2d78" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#fff', fontWeight: '600' }}>Weak Areas</h3>
                            </div>
                            
                            {/* Practice Weak Areas Action Trigger */}
                            {weaknesses.length > 0 && (
                                <button
                                    onClick={handlePracticeWeakAreas}
                                    className="no-print"
                                    style={{
                                        backgroundColor: 'rgba(225,3,77,0.1)',
                                        color: '#e1034d',
                                        border: '1px solid rgba(225,3,77,0.3)',
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.75rem',
                                        borderRadius: '0.35rem',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    Practice Weak Areas
                                </button>
                            )}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#ccc', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {weaknesses.length === 0 ? (
                                <li style={{ listStyleType: 'none', color: '#888', fontStyle: 'italic', paddingLeft: 0, marginLeft: '-1.2rem' }}>No weakness areas noted.</li>
                            ) : (
                                weaknesses.map((item, idx) => <li key={idx}>{item}</li>)
                            )}
                        </ul>
                    </div>

                </div>

                {/* Recommendations */}
                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#fff', fontWeight: '600' }}>Actionable Recommendations</h3>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#ccc', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {recommendation.length === 0 ? (
                            <li style={{ listStyleType: 'none', color: '#888', fontStyle: 'italic', paddingLeft: 0, marginLeft: '-1.2rem' }}>No specific recommendations generated.</li>
                        ) : (
                            recommendation.map((rec, idx) => <li key={idx}>{rec}</li>)
                        )}
                    </ul>
                </div>

                {/* Personalized Study Plan Card */}
                {studyPlan && studyPlan.length > 0 && (
                    <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1.2rem', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: '#fff', borderBottom: '1px solid #1a1a2e', paddingBottom: '0.5rem', margin: 0 }}>
                            Personalized 4-Week Study Plan
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                            {studyPlan.map((weekData, idx) => (
                                <div key={idx} style={{ backgroundColor: '#0a0a0f', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#e1034d', fontWeight: '700', textTransform: 'uppercase' }}>Week {weekData.week}</span>
                                    <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{weekData.focus}</strong>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#aaa', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        {(weekData.tasks || []).map((task, tidx) => <li key={tidx}>{task}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Page Break for print settings */}
                <div className="print-page-break" style={{ height: '1px' }} />

                {/* Question-Wise Performance Accordion list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a2e', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#fff', margin: 0 }}>Interview Log & Feedback</h3>
                        
                        {/* Question Filters Tab Row */}
                        <div className="no-print" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {[
                                { key: "all", label: "All Questions" },
                                { key: "technical", label: "Technical" },
                                { key: "behavioral", label: "Behavioral" },
                                { key: "strong", label: "Strong Answers" },
                                { key: "weak", label: "Weak Answers" }
                            ].map(filter => (
                                <button
                                    key={filter.key}
                                    onClick={() => setQuestionFilter(filter.key)}
                                    style={{
                                        backgroundColor: questionFilter === filter.key ? '#e1034d' : '#111120',
                                        border: '1px solid #1c1c3a',
                                        color: '#fff',
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.75rem',
                                        borderRadius: '0.25rem',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s ease'
                                    }}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {filteredQuestions.length === 0 ? (
                            <p style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No questions match this filter.</p>
                        ) : (
                            filteredQuestions.map(({ q, idx, evalObj, ans }) => {
                                if (!evalObj) return null
                                const star = starScores[idx]
                                const hasStarData = star && (star.situation || star.task || star.action || star.result)

                                return (
                                    <div key={idx} style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', pageBreakInside: 'avoid' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#e1034d', fontWeight: '600' }}>Q{idx + 1}: {q.topic || q.competency}</span>
                                            <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(225, 3, 77, 0.1)', color: '#e1034d', padding: '0.25rem 0.6rem', borderRadius: '0.35rem', fontWeight: '700' }}>
                                                Score: {evalObj.score}/10
                                            </span>
                                        </div>
                                        
                                        <h4 style={{ fontSize: '1.05rem', margin: 0, fontWeight: '500', lineHeight: '1.4' }}>{q.question}</h4>
                                        
                                        <div style={{ fontSize: '0.85rem', color: '#ccc', borderLeft: '2px solid #e1034d', paddingLeft: '0.75rem', margin: '0.2rem 0' }}>
                                            <strong>Your Response:</strong> {ans || <em style={{ color: '#555' }}>Skipped / No Answer</em>}
                                        </div>

                                        {/* STAR Method details */}
                                        {hasStarData && (
                                            <div style={{ backgroundColor: 'rgba(225,3,77,0.02)', border: '1px solid rgba(225,3,77,0.1)', borderRadius: '0.5rem', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.75rem', color: '#ff2d78', fontWeight: 'bold', textTransform: 'uppercase' }}>STAR Method Breakdown</span>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                                                    <div style={{ borderRight: '1px solid #1a1a2e' }}>
                                                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#888' }}>Situation</span>
                                                        <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{star.situation}/10</strong>
                                                    </div>
                                                    <div style={{ borderRight: '1px solid #1a1a2e' }}>
                                                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#888' }}>Task</span>
                                                        <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{star.task}/10</strong>
                                                    </div>
                                                    <div style={{ borderRight: '1px solid #1a1a2e' }}>
                                                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#888' }}>Action</span>
                                                        <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{star.action}/10</strong>
                                                    </div>
                                                    <div>
                                                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#888' }}>Result</span>
                                                        <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{star.result}/10</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Follow-up Questions details */}
                                        {mockInterview.followUpQuestions[idx]?.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#0a0a0f', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1c1c3a' }}>
                                                <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 'bold', textTransform: 'uppercase' }}>Follow-Up Thread</span>
                                                {mockInterview.followUpQuestions[idx].map((fq, fidx) => {
                                                    const fa = mockInterview.followUpAnswers[idx]?.[fidx]
                                                    const feval = mockInterview.followUpEvaluations[idx]?.[fidx]
                                                    return (
                                                        <div key={fidx} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', borderTop: fidx > 0 ? '1px solid #1c1c3a' : 'none', paddingTop: fidx > 0 ? '0.5rem' : 0 }}>
                                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#eee' }}><strong>Follow-up Q{fidx + 1}:</strong> {fq}</p>
                                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic' }}><strong>Answer:</strong> {fa || <em style={{ color: '#555' }}>Skipped</em>}</p>
                                                            {feval && (
                                                                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem' }}>
                                                                    <span style={{ color: '#e1034d' }}>Score: {feval.score}/10</span>
                                                                    <span style={{ color: '#888' }}>| Feedback: {feval.feedback}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {/* Evaluation Subscores */}
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', backgroundColor: '#0a0a0f', padding: '0.6rem', borderRadius: '0.35rem' }}>
                                            <span style={{ color: '#aaa' }}>Accuracy: <strong style={{ color: '#fff' }}>{evalObj.subScores?.technicalAccuracy || 0}/10</strong></span>
                                            <span style={{ color: '#aaa' }}>Completeness: <strong style={{ color: '#fff' }}>{evalObj.subScores?.completeness || 0}/10</strong></span>
                                            <span style={{ color: '#aaa' }}>Clarity: <strong style={{ color: '#fff' }}>{evalObj.subScores?.clarity || 0}/10</strong></span>
                                            <span style={{ color: '#aaa' }}>Relevance: <strong style={{ color: '#fff' }}>{evalObj.subScores?.relevance || 0}/10</strong></span>
                                        </div>

                                        {/* Strengths & Improvements */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                                            {evalObj.strengths && evalObj.strengths.length > 0 && (
                                                <div>
                                                    <strong style={{ color: '#10b981' }}>Strengths:</strong>
                                                    <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1.2rem', color: '#aaa' }}>
                                                        {evalObj.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {evalObj.improvements && evalObj.improvements.length > 0 && (
                                                <div style={{ marginTop: '0.25rem' }}>
                                                    <strong style={{ color: '#ff2d78' }}>Improvements needed:</strong>
                                                    <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1.2rem', color: '#aaa' }}>
                                                        {evalObj.improvements.map((s, i) => <li key={i}>{s}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {evalObj.betterAnswer && (
                                                <div style={{ marginTop: '0.25rem', backgroundColor: 'rgba(59,130,246,0.05)', border: '1px dashed rgba(59,130,246,0.2)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                                    <strong style={{ color: '#3b82f6', display: 'block', marginBottom: '0.25rem' }}>Exemplary Answer:</strong>
                                                    <p style={{ margin: 0, color: '#b0c4de', lineHeight: '1.4', fontStyle: 'italic' }}>"{evalObj.betterAnswer}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

            </div>

            {/* Delete Confirmation Alert Modal Overlay */}
            {showDeleteModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#111120',
                        border: '1px solid #1c1c3a',
                        borderRadius: '0.75rem',
                        padding: '2rem',
                        width: '100%',
                        maxWidth: '420px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        textAlign: 'center',
                        color: '#fff',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '600' }}>Confirm Deletion</h3>
                        <p style={{ fontSize: '0.9rem', color: '#ccc', margin: 0 }}>
                            Are you sure you want to delete this mock interview record?
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="button secondary-button"
                                style={{ flex: 1, padding: '0.6rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="button primary-button"
                                style={{ flex: 1, padding: '0.6rem', backgroundColor: '#ff2d78', border: '1px solid #ff2d78' }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Embed print styles */}
            <style>{`
                @media print {
                    body {
                        background-color: #fff !important;
                        color: #000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .print-container {
                        background-color: #fff !important;
                        color: #000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    div, p, h1, h2, h3, h4, li, span, strong {
                        color: #000 !important;
                    }
                    .print-page-break {
                        page-break-after: always !important;
                        display: block !important;
                    }
                    /* Ensure containers print nicely without dark bg colors */
                    div[style*="backgroundColor"], div[style*="background-color"] {
                        background-color: #f7f7fa !important;
                        border: 1px solid #ddd !important;
                    }
                }
            `}</style>
        </div>
    )
}

export default MockInterviewSummary
