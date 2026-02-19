import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    @ApiProperty({
        description: 'String Token penuh dari dalam file .mgc (Format: PayloadBase64.Signature)',
        example: 'eyJtZXRhIjp7InZlcnNpb24iOiIxLjAifX0=.a1b2c3d4e5f6...',
        required: true,
    })
    @IsNotEmpty({ message: 'Konten file simulasi (.mgc) tidak boleh kosong.' })
    @IsString({ message: 'Format token tidak valid.' })
    simulationToken: string;
}