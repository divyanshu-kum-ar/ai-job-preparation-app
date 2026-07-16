import React, { useState, useEffect } from 'react'
import { getMockInterviews } from '../services/mock.api'
import { useNavigate } from 'react-router'

const MockAnalytics = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState(null)
    const [error, setError] = useState(null)

    const fetchAnalytics = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await getMockInterviews()
            setData(res)
        } catch (err) {
            console.error(err)
            setError(err.response?.data?.message || "Failed to load analytics.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAnalytics()
    }, [])

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', gap: '1rem', color: '#fff' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #e1034d', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>Loading interview analytics...</p>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#111120', borderRadius: '1rem', border: '1px solid #1c1c3a' }}>
                <p style={{ color: '#ff2d78' }}>{error}</p>
                <button onClick={fetchAnalytics} className="button secondary-button" style={{ marginTop: '1rem' }}>Retry</button>
            </div>
        )
    }

    const { mockInterviews = [], analytics = {}, topicHeatmap = [], badges = [] } = data || {}

    const {
        totalInterviews = 0,
        averageScore = 0,
        highestScore = 0,
        lowestScore = 0,
        totalQuestionsAttempted = 0,
        averageResponseTime = 0,
        overallImprovement = "+0%",
        currentStreak = 0,
        strongestTopic = "N/A",
        weakestTopic = "N/A"
    } = analytics

    // Predefined Badge Catalog for locked state display
    const ALL_BADGES = [
        { id: "java_expert", name: "Java Expert", desc: "Score >85% in Java", color: "#3b82f6", icon: "☕" },
        { id: "sql_master", name: "SQL Master", desc: "Score >85% in SQL", color: "#10b981", icon: "💾" },
        { id: "rest_champion", name: "REST Champion", desc: "Score >85% in REST APIs", color: "#8b5cf6", icon: "🌐" },
        { id: "behavioral_pro", name: "Behavioral Pro", desc: "Score >85% in Behavioral", color: "#f59e0b", icon: "🗣️" },
        { id: "interview_legend", name: "Mock Interview Legend", desc: "Complete 5 mock sessions or average score >80%", color: "#e1034d", icon: "👑" }
    ]

    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A"
        const date = new Date(dateStr)
        const months = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"]
        const monthName = date.toLocaleString('default', { month: 'long' })
        return `${date.getDate()} ${monthName} ${date.getFullYear()}`
    }

    const formattedTime = (secs) => {
        if (!secs) return "N/A"
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return m > 0 ? `${m}m ${s}s` : `${s}s`
    }

    // Score History Data mapping (chronological order)
    const history = mockInterviews.slice().reverse().map((m, idx) => ({
        label: `Int #${idx + 1}`,
        score: m.score
    }))

    // Custom SVG Line Graph coordinate mapping
    const graphWidth = 500
    const graphHeight = 150
    const paddingVal = 20
    const chartWidth = graphWidth - paddingVal * 2
    const chartHeight = graphHeight - paddingVal * 2

    let pointsPath = ""
    let pointsCircle = []

    if (history.length > 0) {
        const xStep = history.length > 1 ? chartWidth / (history.length - 1) : chartWidth
        history.forEach((pt, idx) => {
            const x = paddingVal + idx * xStep
            const y = paddingVal + chartHeight - (pt.score / 100) * chartHeight
            if (idx === 0) {
                pointsPath = `M ${x} ${y}`
            } else {
                pointsPath += ` L ${x} ${y}`
            }
            pointsCircle.push({ x, y, score: pt.score, label: pt.label })
        })
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* KPI Cards Grid - Fully Responsive */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem'
            }}>
                
                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Interviews</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#fff' }}>{totalInterviews}</span>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>Attempted mock sessions</span>
                </div>

                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Highest Score</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#3b82f6' }}>{highestScore}%</span>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>Personal record</span>
                </div>

                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Average Score</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#10b981' }}>{averageScore}%</span>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>Overall rating average</span>
                </div>

                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lowest Score</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#f59e0b' }}>{lowestScore}%</span>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>Base performance baseline</span>
                </div>

                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Questions Attempted</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#fff' }}>{totalQuestionsAttempted}</span>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>Total base questions</span>
                </div>

                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Streak</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#e1034d' }}>🔥 {currentStreak} Days</span>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>Consecutive daily practice</span>
                </div>

            </div>

            {/* Middle Section: Trend Graph & Topic Heatmap - Fully Responsive */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem'
            }}>
                
                {/* Score Trend Graph */}
                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a2e', paddingBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#ccc' }}>Performance over Time</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: '#888' }}>
                            <span>High: <strong style={{ color: '#3b82f6' }}>{highestScore}%</strong></span>
                            <span>Low: <strong style={{ color: '#f59e0b' }}>{lowestScore}%</strong></span>
                            <span>Avg: <strong style={{ color: '#10b981' }}>{averageScore}%</strong></span>
                        </div>
                    </div>
                    {history.length === 0 ? (
                        <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            Need at least 1 completed interview to show trend.
                        </div>
                    ) : (
                        <div style={{ width: '100%', overflowX: 'auto' }}>
                            <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                                {/* Horizontal grid lines */}
                                {[0, 25, 50, 75, 100].map((gr, idx) => {
                                    const y = paddingVal + chartHeight - (gr / 100) * chartHeight
                                    return (
                                        <g key={idx}>
                                            <line x1={paddingVal} y1={y} x2={graphWidth - paddingVal} y2={y} stroke="#1f1f38" strokeWidth="1" strokeDasharray="4 4" />
                                            <text x={paddingVal - 5} y={y + 3} fill="#555" fontSize="8" textAnchor="end">{gr}</text>
                                        </g>
                                    )
                                })}

                                {/* Main Line */}
                                {history.length > 1 && (
                                    <path d={pointsPath} fill="none" stroke="#e1034d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                )}

                                {/* Value Circles & Labels */}
                                {pointsCircle.map((pt, idx) => (
                                    <g key={idx}>
                                        <circle cx={pt.x} cy={pt.y} r="5" fill="#e1034d" stroke="#111120" strokeWidth="2" />
                                        <text x={pt.x} y={pt.y - 8} fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">{pt.score}</text>
                                        <text x={pt.x} y={paddingVal + chartHeight + 12} fill="#666" fontSize="8" textAnchor="middle">{pt.label}</text>
                                    </g>
                                ))}
                            </svg>
                        </div>
                    )}
                </div>

                {/* Topic-Wise Heatmap */}
                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a2e', paddingBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#ccc' }}>Topic Analytics Heatmap</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem' }}>
                            <span style={{ color: '#10b981' }}>Strongest: {strongestTopic}</span>
                            <span style={{ color: '#ff2d78' }}>Weakest: {weakestTopic}</span>
                        </div>
                    </div>
                    {topicHeatmap.length === 0 ? (
                        <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            No topic analytics generated yet.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {topicHeatmap.map((item, idx) => {
                                const isStrong = item.score >= 80
                                const isWeak = item.score > 0 && item.score < 60
                                const color = isStrong ? '#10b981' : isWeak ? '#ff2d78' : '#3b82f6'

                                return (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#eee', fontWeight: '500' }}>{item.topic}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span style={{ color: color, fontWeight: 'bold' }}>{item.score}%</span>
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    padding: '0.1rem 0.3rem',
                                                    borderRadius: '0.25rem',
                                                    backgroundColor: isStrong ? 'rgba(16,185,129,0.1)' : isWeak ? 'rgba(255,45,120,0.1)' : 'rgba(59,130,246,0.1)',
                                                    color: color
                                                }}>
                                                    {isStrong ? 'Strong' : isWeak ? 'Weak' : 'Avg'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ width: '100%', height: '5px', backgroundColor: '#1a1a2e', borderRadius: '2.5px', overflow: 'hidden' }}>
                                            <div style={{ width: `${item.score}%`, height: '100%', backgroundColor: color }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* Badges Showcase */}
            <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, borderBottom: '1px solid #1a1a2e', paddingBottom: '0.5rem', color: '#ccc' }}>Achievement Badges</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '1rem',
                    marginTop: '0.5rem'
                }}>
                    {ALL_BADGES.map(badge => {
                        const isUnlocked = badges.some(b => b.id === badge.id)
                        
                        return (
                            <div
                                key={badge.id}
                                style={{
                                    backgroundColor: isUnlocked ? '#16162a' : '#0e0e1a',
                                    border: isUnlocked ? `1px solid ${badge.color}` : '1px dashed #2c2c48',
                                    opacity: isUnlocked ? 1 : 0.4,
                                    borderRadius: '0.75rem',
                                    padding: '1rem 0.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <span style={{ fontSize: '2rem' }}>{badge.icon}</span>
                                <h4 style={{ fontSize: '0.8rem', margin: 0, fontWeight: 'bold', color: isUnlocked ? '#fff' : '#666' }}>{badge.name}</h4>
                                <span style={{ fontSize: '0.65rem', color: '#888', lineHeight: '1.2' }}>{badge.desc}</span>
                                {isUnlocked && (
                                    <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        Unlocked
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* List of Previous Sessions - Formatted History */}
            {mockInterviews.length > 0 && (
                <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, borderBottom: '1px solid #1a1a2e', paddingBottom: '0.5rem', color: '#fff' }}>My Mock Interviews</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {mockInterviews.map((m) => (
                            <div
                                key={m._id}
                                onClick={() => navigate(`/mock/${m._id}/summary`)}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '1.25rem',
                                    backgroundColor: '#0a0a0f',
                                    borderRadius: '0.75rem',
                                    border: '1px solid #1c1c3a',
                                    cursor: 'pointer',
                                    transition: 'border-color 0.2s ease',
                                    flexWrap: 'wrap',
                                    gap: '1rem'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#e1034d'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1c1c3a'}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                                        {m.report?.title || "Mock Session"}
                                    </h4>
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#aaa' }}>
                                        <span>Difficulty: <strong style={{ color: '#fff' }}>{m.difficulty || 'Medium'}</strong></span>
                                        <span>•</span>
                                        <span>Company: <strong style={{ color: '#fff' }}>{m.companyMode || 'Generic'}</strong></span>
                                        <span>•</span>
                                        <span>Questions: <strong style={{ color: '#fff' }}>{m.questions?.length || 0}</strong></span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem' }}>
                                        Completed: {formatDate(m.completedAt)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ display: 'block', fontSize: '1.1rem', color: '#e1034d', fontWeight: 'bold' }}>{m.score}/100</span>
                                        <span style={{ fontSize: '0.65rem', color: '#888' }}>View Details</span>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e1034d' }}><polyline points="9 18 15 12 9 6"/></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    )
}

export default MockAnalytics
