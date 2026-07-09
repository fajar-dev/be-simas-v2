import axios, { AxiosInstance } from "axios"
import { config } from "../../config/config"

export type EsignSigner = {
    nama: string
    email: string
    phone: string
}

export type DocumentSignParams = {
    file: File
    external_reference_id: string | number
    signers: EsignSigner[]
    title?: string
}

export class EsignHelper {
    private readonly http: AxiosInstance = axios.create({
        baseURL: config.esign.apiUrl,
        headers: {
            Accept: "application/json",
        },
    })

    private async getToken(): Promise<string> { 
        const res = await this.http.post<any>('/oauth/token', { 
            grant_type: 'client_credentials', 
            client_id: config.esign.clientId, 
            client_secret: config.esign.clientSecret, 
            scope: 'esign.documents.upload_draft esign.documents.read' }, 
            { 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', }, 
            }) 
        return res.data.access_token as string 
    }

    async documentSign(params: DocumentSignParams): Promise<any[]> {
        const token = await this.getToken()

        const form = new FormData()

        form.append("file", params.file, params.file.name)
        form.append("title", params.title ?? "Serah Terima Barang")
        form.append("external_reference_id", String(params.external_reference_id))
        form.append("signing_mode", "SERIAL")
        form.append("uploader_name", "SIMAS")

        form.append(
            "callback_complete",
            `${config.app.appUrl}/api/webhook/esign`
        )

        form.append(
            "callback_reject",
            `${config.app.appUrl}/api/webhook/esign`
        )

        form.append("signers", JSON.stringify(params.signers))

        const res = await this.http.post<any>(
            `/${config.esign.tenantSlug}/api/esign/v2/integration/documents/direct`,
            form,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            }
        )

        return (res?.data?.data as any[]) ?? []
    }
}

export const esignHelper = new EsignHelper()