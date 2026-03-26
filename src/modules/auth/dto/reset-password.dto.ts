import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'Kata sandi baru untuk akun pengguna (Minimal 8 karakter). Direkomendasikan menggunakan frasa sandi (passphrase).',
        example: 'kopipagihangat',
    })
    @IsString({ message: 'Password harus berupa string.' })
    @IsNotEmpty({ message: 'Password baru tidak boleh kosong.' })

    // [REFACTORED] Murni mengandalkan batasan panjang minimum (Minimum Length Constraint)
    @MinLength(8, { message: 'Kata sandi terlalu pendek. Minimal harus 8 karakter demi keamanan.' })

    // [REMOVED] Decorator @Matches() telah dihapus secara permanen untuk 
    // menghapus kewajiban kombinasi karakter (huruf besar/kecil, angka, simbol) 
    // demi meningkatkan User Experience (UX) bagi agen senior.
    newPassword: string;
}