import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'Password baru dengan kombinasi keamanan tinggi',
        example: 'KeuanganKu!2026',
    })
    @IsString({ message: 'Password harus berupa string.' })
    @IsNotEmpty({ message: 'Password baru tidak boleh kosong.' })
    @MinLength(8, { message: 'Password minimal harus 8 karakter.' })
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        {
            message: 'Password harus mengandung huruf besar, huruf kecil, angka, dan karakter spesial (@$!%*?&).',
        },
    )
    newPassword: string;
}