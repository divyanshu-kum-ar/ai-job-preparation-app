import React, { useState, useEffect } from 'react'
import '../style/interview.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate, useParams } from 'react-router'



const NAV_ITEMS = [
    { id: 'technical', label: 'Technical Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>) },
    { id: 'behavioral', label: 'Behavioral Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>) },
    { id: 'roadmap', label: 'Road Map', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>) },
    { id: 'resume', label: 'Resume Preview', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>) },
]

// ── Sub-components ────────────────────────────────────────────────────────────
const TechnicalQuestionCard = ({ item, index }) => {
    const [ open, setOpen ] = useState(false)
    const points = Array.isArray(item.expectedPoints) ? item.expectedPoints : [];
    return (
        <div className='q-card'>
            <div className='q-card__header' onClick={() => setOpen(o => !o)}>
                <span className='q-card__index'>Q{index + 1}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p className='q-card__question' style={{ margin: 0 }}>{item.question}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className='q-card__tag' style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: '0.25rem' }}>
                            Topic: {item.topic}
                        </span>
                        <span className='q-card__tag' style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '0.25rem' }}>
                            Difficulty: {item.difficulty}
                        </span>
                    </div>
                </div>
                <span className={`q-card__chevron ${open ? 'q-card__chevron--open' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
            </div>
            {open && (
                <div className='q-card__body'>
                    <div className='q-card__section'>
                        <span className='q-card__tag q-card__tag--answer'>Expected Talking Points</span>
                        {points.length === 0 ? (
                            <p style={{ fontStyle: 'italic', color: '#888' }}>No guidance points generated.</p>
                        ) : (
                            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', color: '#ccc' }}>
                                {points.map((pt, i) => (
                                    <li key={i} style={{ marginBottom: '0.25rem' }}>{pt}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const BehavioralQuestionCard = ({ item, index }) => {
    const [ open, setOpen ] = useState(false)
    return (
        <div className='q-card'>
            <div className='q-card__header' onClick={() => setOpen(o => !o)}>
                <span className='q-card__index'>Q{index + 1}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p className='q-card__question' style={{ margin: 0 }}>{item.question}</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span className='q-card__tag' style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderRadius: '0.25rem' }}>
                            Competency: {item.competency}
                        </span>
                    </div>
                </div>
                <span className={`q-card__chevron ${open ? 'q-card__chevron--open' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
            </div>
            {open && (
                <div className='q-card__body'>
                    <div className='q-card__section'>
                        <span className='q-card__tag q-card__tag--intention'>Answer Guidance</span>
                        <p>{item.answerGuidance || 'Use the STAR format to structure your response.'}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

const RoadMapDay = ({ day }) => (
    <div className='roadmap-day'>
        <div className='roadmap-day__header'>
            <span className='roadmap-day__badge'>Day {day.day}</span>
            <h3 className='roadmap-day__focus'>{day.focus}</h3>
        </div>
        <ul className='roadmap-day__tasks'>
            {day.tasks.map((task, i) => (
                <li key={i}>
                    <span className='roadmap-day__bullet' />
                    {task}
                </li>
            ))}
        </ul>
    </div>
)

// ── Main Component ────────────────────────────────────────────────────────────
const Interview = () => {
    const [ activeNav, setActiveNav ] = useState('technical')
    const [ downloading, setDownloading ] = useState(false)
    const [ downloadError, setDownloadError ] = useState(null)
    const [ loadingHtml, setLoadingHtml ] = useState(false)

    const { report, getReportById, loading, getResumePdf, resumeHtml, setResumeHtml, getResumeHtmlContent, deleteReport, regenerateReport } = useInterview()
    const { interviewId } = useParams()
    const navigate = useNavigate()

    const loadResumeHtml = async () => {
        setLoadingHtml(true)
        setDownloadError(null)
        try {
            await getResumeHtmlContent(interviewId)
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingHtml(false)
        }
    }

    useEffect(() => {
        if (activeNav === 'resume' && !resumeHtml) {
            loadResumeHtml()
        }
    }, [ activeNav, resumeHtml ])

    const handleDownload = async () => {
        setDownloading(true)
        setDownloadError(null)
        try {
            await getResumePdf(interviewId, resumeHtml)
        } catch (err) {
            console.error(err)
            setDownloadError("Download failed.")
        } finally {
            setDownloading(false)
        }
    }

    const handleIframeLoad = (iframe) => {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc || !iframeDoc.documentElement) return;

            // Prevent infinite loops
            if (iframeDoc.documentElement.getAttribute('data-adjusted') === 'true') {
                return;
            }

            const root = iframeDoc.documentElement;
            const a4Height = 1122; // Height of A4 at 96 DPI
            
            const getDocHeight = () => iframeDoc.documentElement.scrollHeight;
            
            let contentHeight = getDocHeight();
            let utilization = (contentHeight / a4Height) * 100;
            console.log(`[Preview] Initial - A4 Height: ${a4Height}px, Content Height: ${contentHeight}px, Utilization: ${utilization.toFixed(1)}%`);

            let attempts = 0;
            const maxAttempts = 20;

            // Scale up if utilization is below 90%
            while (contentHeight < 1010 && attempts < maxAttempts) {
                attempts++;
                
                const getVal = (name) => {
                    const styleVal = iframeDoc.defaultView.getComputedStyle(root).getPropertyValue(name);
                    return styleVal ? parseFloat(styleVal) : null;
                };

                const bodyFontSize = getVal('--body-font-size') || 9.5;
                const lineHeight = getVal('--line-height') || 1.35;
                const nameSize = getVal('--name-size') || 19;
                const headingSize = getVal('--heading-size') || 12;
                const sectionSpacing = getVal('--section-spacing') || 8;
                const entrySpacing = getVal('--entry-spacing') || 5;
                const bulletSpacing = getVal('--bullet-spacing') || 2;

                root.style.setProperty('--body-font-size', `${bodyFontSize + 0.1}px`);
                root.style.setProperty('--line-height', `${lineHeight + 0.02}`);
                root.style.setProperty('--name-size', `${nameSize + 0.2}px`);
                root.style.setProperty('--heading-size', `${headingSize + 0.15}px`);
                root.style.setProperty('--section-spacing', `${sectionSpacing + 0.5}px`);
                root.style.setProperty('--entry-spacing', `${entrySpacing + 0.4}px`);
                root.style.setProperty('--bullet-spacing', `${bulletSpacing + 0.2}px`);

                contentHeight = getDocHeight();
                utilization = (contentHeight / a4Height) * 100;
                console.log(`[Preview] Scale Up ${attempts} - Content Height: ${contentHeight}px, Utilization: ${utilization.toFixed(1)}%`);
            }

            // Scale down if utilization is over 98% (1100px) to prevent 2nd page spillover
            while (contentHeight > 1100 && attempts < maxAttempts) {
                attempts++;
                
                const getVal = (name) => {
                    const styleVal = iframeDoc.defaultView.getComputedStyle(root).getPropertyValue(name);
                    return styleVal ? parseFloat(styleVal) : null;
                };

                const bodyFontSize = getVal('--body-font-size') || 9.5;
                const lineHeight = getVal('--line-height') || 1.35;
                const nameSize = getVal('--name-size') || 19;
                const headingSize = getVal('--heading-size') || 12;
                const sectionSpacing = getVal('--section-spacing') || 8;
                const entrySpacing = getVal('--entry-spacing') || 5;
                const bulletSpacing = getVal('--bullet-spacing') || 2;

                root.style.setProperty('--body-font-size', `${bodyFontSize - 0.05}px`);
                root.style.setProperty('--line-height', `${lineHeight - 0.01}`);
                root.style.setProperty('--name-size', `${nameSize - 0.1}px`);
                root.style.setProperty('--heading-size', `${headingSize - 0.1}px`);
                root.style.setProperty('--section-spacing', `${sectionSpacing - 0.25}px`);
                root.style.setProperty('--entry-spacing', `${entrySpacing - 0.2}px`);
                root.style.setProperty('--bullet-spacing', `${bulletSpacing - 0.1}px`);

                contentHeight = getDocHeight();
                utilization = (contentHeight / a4Height) * 100;
                console.log(`[Preview] Scale Down ${attempts} - Content Height: ${contentHeight}px, Utilization: ${utilization.toFixed(1)}%`);
            }

            console.log(`[Preview] Final Page Utilization - A4 Height: ${a4Height}px, Content Height: ${contentHeight}px, Utilization: ${utilization.toFixed(1)}%`);
            
            iframeDoc.documentElement.setAttribute('data-adjusted', 'true');
            setResumeHtml(iframeDoc.documentElement.outerHTML);
        } catch (err) {
            console.error("Error adjusting iframe preview height:", err);
        }
    };

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        }
    }, [ interviewId ])

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this interview plan?")) {
            const success = await deleteReport(interviewId)
            if (success) {
                navigate("/")
            } else {
                alert("Failed to delete report.")
            }
        }
    }

    const handleRegenerate = async () => {
        if (window.confirm("Are you sure you want to regenerate this plan? This will overwrite the current questions and roadmap.")) {
            const updated = await regenerateReport(interviewId)
            if (updated) {
                alert("Interview plan regenerated successfully!")
            } else {
                alert("Failed to regenerate report. Please try again.")
            }
        }
    }

    if (loading || !report) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview plan...</h1>
            </main>
        )
    }

    const matchScore = report.matchScore ?? 0
    const scoreColor =
        matchScore >= 80 ? 'score--high' :
            matchScore >= 60 ? 'score--mid' : 'score--low'


    return (
        <div className='interview-page'>
            <div className='interview-layout'>

                {/* ── Left Nav ── */}
                <nav className='interview-nav' aria-label="Strategy Navigation">
                    <div className="nav-content">
                        <p className='interview-nav__label'>Sections</p>
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                className={`interview-nav__item ${activeNav === item.id ? 'interview-nav__item--active' : ''}`}
                                onClick={() => setActiveNav(item.id)}
                                aria-label={`View ${item.label}`}
                            >
                                <span className='interview-nav__icon'>{item.icon}</span>
                                {item.label}
                            </button>
                        ))}

                        <div className="sidebar-action-group" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1.5rem" }}>
                            <button
                                onClick={handleRegenerate}
                                className="button secondary-button"
                                style={{ width: "100%", padding: "0.6rem", fontSize: "0.85rem" }}
                                aria-label="Regenerate Interview Strategy"
                            >
                                Regenerate Plan
                            </button>
                            <button
                                onClick={handleDelete}
                                className="button danger-button"
                                style={{ width: "100%", padding: "0.6rem", fontSize: "0.85rem", backgroundColor: "#ff2d78", color: "white", border: "1px solid #ff2d78", borderRadius: "0.5rem", cursor: "pointer" }}
                                aria-label="Delete Interview Strategy"
                            >
                                Delete Plan
                            </button>
                        </div>
                    </div>

                    {report.resume && (
                        <button
                            onClick={() => { getResumePdf(interviewId, resumeHtml) }}
                            className='button primary-button'
                            aria-label="Download Resume PDF"
                        >
                            <svg height={"0.8rem"} style={{ marginRight: "0.8rem" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.6144 17.7956 11.492 15.7854C12.2731 13.9966 13.6789 12.5726 15.4325 11.7942L17.8482 10.7219C18.6162 10.381 18.6162 9.26368 17.8482 8.92277L15.5079 7.88394C13.7092 7.08552 12.2782 5.60881 11.5105 3.75894L10.6215 1.61673C10.2916.821765 9.19319.821767 8.8633 1.61673L7.97427 3.75892C7.20657 5.60881 5.77553 7.08552 3.97685 7.88394L1.63658 8.92277C.868537 9.26368.868536 10.381 1.63658 10.7219L4.0523 11.7942C5.80589 12.5726 7.21171 13.9966 7.99275 15.7854L8.8704 17.7956C9.20776 18.5682 10.277 18.5682 10.6144 17.7956ZM19.4014 22.6899 19.6482 22.1242C20.0882 21.1156 20.8807 20.3125 21.8695 19.8732L22.6299 19.5353C23.0412 19.3526 23.0412 18.7549 22.6299 18.5722L21.9121 18.2532C20.8978 17.8026 20.0911 16.9698 19.6586 15.9269L19.4052 15.3156C19.2285 14.8896 18.6395 14.8896 18.4628 15.3156L18.2094 15.9269C17.777 16.9698 16.9703 17.8026 15.956 18.2532L15.2381 18.5722C14.8269 18.7549 14.8269 19.3526 15.2381 19.5353L15.9985 19.8732C16.9874 20.3125 17.7798 21.1156 18.2198 22.1242L18.4667 22.6899C18.6473 23.104 19.2207 23.104 19.4014 22.6899Z"></path></svg>
                            Download Resume
                        </button>
                    )}
                </nav>

                <div className='interview-divider' />

                {/* ── Center Content ── */}
                <main className='interview-content'>
                    {activeNav === 'technical' && (
                        <section>
                            <div className='content-header'>
                                <h2>Technical Questions</h2>
                                <span className='content-header__count'>{(report.technicalQuestions || []).length} questions</span>
                            </div>
                            <div className='q-list'>
                                {!(report.technicalQuestions || []).length ? (
                                    <p className='empty-state'>No technical questions were generated. Please retry with more detail in the job description or resume.</p>
                                ) : (
                                    (report.technicalQuestions || []).map((q, i) => (
                                        <TechnicalQuestionCard key={i} item={q} index={i} />
                                    ))
                                )}
                            </div>
                        </section>
                    )}

                    {activeNav === 'behavioral' && (
                        <section>
                            <div className='content-header'>
                                <h2>Behavioral Questions</h2>
                                <span className='content-header__count'>{(report.behavioralQuestions || []).length} questions</span>
                            </div>
                            <div className='q-list'>
                                {!(report.behavioralQuestions || []).length ? (
                                    <p className='empty-state'>No behavioral questions were generated. Please retry with more detail in the job description or resume.</p>
                                ) : (
                                    (report.behavioralQuestions || []).map((q, i) => (
                                        <BehavioralQuestionCard key={i} item={q} index={i} />
                                    ))
                                )}
                            </div>
                        </section>
                    )}

                    {activeNav === 'roadmap' && (
                        <section>
                            <div className='content-header'>
                                <h2>Preparation Road Map</h2>
                                <span className='content-header__count'>{(report.roadmap || []).length}-day plan</span>
                            </div>
                            <div className='roadmap-list'>
                                {!(report.roadmap || []).length ? (
                                    <p className='empty-state'>No roadmap was generated. Please retry with more detail in the job description or resume.</p>
                                ) : (
                                    (report.roadmap || []).map((day) => (
                                        <RoadMapDay key={day.day} day={day} />
                                    ))
                                )}
                            </div>
                        </section>
                    )}

                    {activeNav === 'resume' && (
                        <section className="resume-preview-section">
                            <div className='content-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2>ATS Resume Preview</h2>
                                    <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.2rem 0 0 0' }}>Clean, single-page, ATS-optimized format</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {downloadError && (
                                        <span style={{ fontSize: '0.8rem', color: '#ff2d78' }}>{downloadError}</span>
                                    )}
                                    <button
                                        onClick={handleDownload}
                                        disabled={downloading || !resumeHtml}
                                        className='button primary-button'
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                        aria-label="Download ATS Resume PDF"
                                    >
                                        {downloading ? 'Downloading...' : 'Download ATS Resume'}
                                    </button>
                                </div>
                            </div>
                            
                            {loadingHtml ? (
                                <div className="resume-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '1rem' }}>
                                    <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                    <p style={{ fontSize: '0.9rem', color: '#888' }}>Generating ATS-optimized resume preview...</p>
                                </div>
                            ) : !resumeHtml ? (
                                <div className="resume-error" style={{ textAlign: 'center', padding: '4rem' }}>
                                    <p style={{ color: '#ff2d78' }}>Failed to generate resume preview. Please try again.</p>
                                    <button onClick={loadResumeHtml} className="button secondary-button" style={{ marginTop: '1rem' }}>Retry</button>
                                </div>
                            ) : (
                                <div className="a4-container-wrapper" style={{ display: 'flex', justifyContent: 'center', width: '100%', overflowX: 'auto', padding: '1rem 0' }}>
                                    <div className="a4-page-preview" style={{
                                        width: '210mm',
                                        height: '297mm',
                                        backgroundColor: '#ffffff',
                                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <iframe
                                            title="ATS Resume Preview"
                                            srcDoc={resumeHtml}
                                            onLoad={(e) => handleIframeLoad(e.target)}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                border: 'none',
                                                backgroundColor: '#ffffff'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </main>

                <div className='interview-divider' />

                {/* ── Right Sidebar ── */}
                <aside className='interview-sidebar'>

                    {/* Match Score */}
                    <div className='match-score'>
                        <p className='match-score__label'>Match Score</p>
                        <div className={`match-score__ring ${scoreColor}`}>
                            <span className='match-score__value'>{matchScore}</span>
                            <span className='match-score__pct'>%</span>
                        </div>
                        <p className='match-score__sub'>Strong match for this role</p>
                    </div>

                    <div className='sidebar-divider' />

                    {/* Skill Gaps */}
                    <div className='skill-gaps'>
                        <p className='skill-gaps__label'>Skill Gaps</p>
                        <div className='skill-gaps__list' style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {!(report.skillGaps || []).length ? (
                                <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', margin: 0 }}>No skill gaps identified.</p>
                            ) : (
                                (report.skillGaps || []).map((gap, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span className={`skill-tag skill-tag--${gap.severity}`} style={{ margin: 0 }}>
                                                {gap.skill}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'capitalize' }}>
                                                ({gap.severity})
                                            </span>
                                        </div>
                                        {gap.reason && (
                                            <p style={{ fontSize: '0.75rem', color: '#aaa', margin: '0 0 0 0.25rem', lineHeight: '1.2' }}>
                                                {gap.reason}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </aside>
            </div>
        </div>
    )
}

export default Interview