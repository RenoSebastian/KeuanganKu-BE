import { IsNotEmpty, IsString } from 'class-validator';

/**
 * ImportSimulationDto
 * -------------------
 * DTO untuk endpoint decoding file .mgc.
 * * Workflow:
 * User upload file .mgc di Frontend -> Frontend membaca isi file (Base64 String) -> Kirim ke Endpoint ini.
 * Backend akan memvalidasi signature HMAC dari string ini.
 */
export class ImportSimulationDto {
    /**
     * Token / Content File .mgc
     * Format: "Base64Payload.HMACSignature"
     */
    @IsNotEmpty({ message: 'Konten file simulasi (.mgc) tidak boleh kosong.' })
    @IsString({ message: 'Format token tidak valid.' })
    simulationToken: string;
}