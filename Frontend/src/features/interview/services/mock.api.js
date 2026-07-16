import axios from "axios"

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials: true
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export async function startMockInterview(configData) {
    // configData: { reportId, companyMode, difficulty, experienceLevel, timerMode, timerLimit, enableFollowUps }
    const response = await api.post("/api/mock/start", configData)
    return response.data
}

export async function submitMockAnswer(id, questionIndex, answer, timeTaken) {
    const response = await api.post(`/api/mock/${id}/answer`, { questionIndex, answer, timeTaken })
    return response.data
}

export async function submitFollowUpAnswer(id, questionIndex, answer, timeTaken) {
    const response = await api.post(`/api/mock/${id}/followup`, { questionIndex, answer, timeTaken })
    return response.data
}

export async function completeMockInterview(id) {
    const response = await api.post(`/api/mock/${id}/complete`)
    return response.data
}

export async function getMockInterviews() {
    const response = await api.get("/api/mock")
    return response.data
}

export async function getMockInterview(id) {
    const response = await api.get(`/api/mock/${id}`)
    return response.data
}

export async function deleteMockInterview(id) {
    const response = await api.delete(`/api/mock/${id}`)
    return response.data
}

export async function practiceWeakAreas(id) {
    const response = await api.post(`/api/mock/${id}/practice-weak`)
    return response.data
}
