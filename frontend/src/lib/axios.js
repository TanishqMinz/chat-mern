import axios from 'axios'


// remember to change baseURL after deploying
export const axiosInstance = axios.create({
    baseURL: "http://localhost:5001/api",
    withCredentials: true
})