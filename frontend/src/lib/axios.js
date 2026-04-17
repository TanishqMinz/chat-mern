import axios from 'axios'


// remember to change baseURL after deploying
export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (import.meta.env.MODE === "development" ? "http://localhost:5001/api": "/api"),
    withCredentials: true
})
