import { getAllInterviewReports, generateInterviewReport, getInterviewReportById, generateResumePdf, generateResumeHtml, deleteInterviewReport, regenerateInterviewReport } from "../services/interview.api"
import { useContext, useEffect } from "react"
import { InterviewContext } from "../interview.context"
import { useParams } from "react-router"


export const useInterview = () => {

    const context = useContext(InterviewContext)
    const { interviewId } = useParams()

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const { loading, setLoading, report, setReport, reports, setReports, resumeHtml, setResumeHtml } = context

    const generateReport = async ({ jobDescription, selfDescription, resumeFile, title }) => {
        setLoading(true)
        let response = null
        try {
            response = await generateInterviewReport({ jobDescription, selfDescription, resumeFile, title })
            if (response?.interviewReport) {
                setReport(response.interviewReport)
                return response.interviewReport
            }
            throw new Error("Interview report was not returned from API")
        } catch (error) {
            console.error("generateReport error:", error)
            return null
        } finally {
            setLoading(false)
        }
    }

    const getReportById = async (interviewId) => {
        setLoading(true)
        let response = null
        try {
            response = await getInterviewReportById(interviewId)
            setReport(response.interviewReport)
            setResumeHtml(null)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
        return response.interviewReport
    }

    const getReports = async () => {
        setLoading(true)
        let response = null
        try {
            response = await getAllInterviewReports()
            setReports(response.interviewReports)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }

        return response.interviewReports
    }

    const getResumePdf = async (interviewReportId, html = null) => {
        setLoading(true)
        let response = null
        try {
            response = await generateResumePdf({ interviewReportId, html })
            const url = window.URL.createObjectURL(new Blob([ response ], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            
            let filename = `resume_${interviewReportId}.pdf`
            if (report && report.title) {
                const cleanTitle = report.title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
                filename = `${cleanTitle}_ATS_Resume.pdf`
            }
            
            link.setAttribute("download", filename)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        }
        catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const getResumeHtmlContent = async (interviewReportId) => {
        setLoading(true)
        try {
            const data = await generateResumeHtml({ interviewReportId })
            setResumeHtml(data.html)
            return data.html
        } catch (error) {
            console.error("getResumeHtmlContent error:", error)
            return null
        } finally {
            setLoading(false)
        }
    }

    const deleteReport = async (interviewId) => {
        setLoading(true)
        let success = false
        try {
            await deleteInterviewReport(interviewId)
            setReports(prev => prev.filter(r => r._id !== interviewId))
            if (report?._id === interviewId) {
                setReport(null)
            }
            success = true
        } catch (error) {
            console.error("Delete report error:", error)
        } finally {
            setLoading(false)
        }
        return success
    }

    const regenerateReport = async (interviewId) => {
        setLoading(true)
        let updatedReport = null
        try {
            const response = await regenerateInterviewReport(interviewId)
            if (response?.interviewReport) {
                setReport(response.interviewReport)
                setReports(prev => prev.map(r => r._id === interviewId ? response.interviewReport : r))
                updatedReport = response.interviewReport
            }
        } catch (error) {
            console.error("Regenerate report error:", error)
        } finally {
            setLoading(false)
        }
        return updatedReport
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        } else {
            getReports()
        }
    }, [ interviewId ])

    return { loading, report, reports, resumeHtml, setResumeHtml, generateReport, getReportById, getReports, getResumePdf, getResumeHtmlContent, deleteReport, regenerateReport }

}