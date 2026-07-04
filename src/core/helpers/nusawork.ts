import axios, { AxiosInstance } from "axios"
import { config } from "../../config/config"

export class NusaworkHelper {
    private readonly http: AxiosInstance = axios.create({
        baseURL: config.nusawork.apiUrl,
        headers: {
            Accept: 'application/json',
        },
    })

    private async getToken(): Promise<string> {
        const res = await this.http.post<any>('/auth/api/oauth/token', {
            grant_type: 'client_credentials',
            client_id: config.nusawork.clientId,
            client_secret: config.nusawork.clientSecret,
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })

        return res.data.access_token as string
    }

    async getEmployees(): Promise<any[]> {
        const token = await this.getToken()

        const res = await this.http.post<any>('/emp/api/v4.2/client/employee/filter', {
            fields: { active_status: ['active', 'Resign'] },
            is_paginate: false,
            multi_value: false,
            currentPage: 1,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })

        return (res?.data?.data as any[]) ?? []
    }

    async getBranch(): Promise<any[]> {
        const token = await this.getToken()

        const res = await this.http.get<any>('/emp/api/branch', {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })

        return (res?.data?.data as any[]) ?? []
    }
}

export const nusaworkHelper = new NusaworkHelper()