import { Type } from 'class-transformer';
import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  ValidateNested, 
  IsEnum, 
  Min, 
  IsDateString 
} from 'class-validator';

// --- ENUMS (Sesuaikan dengan FE) ---
export enum Gender {
  L = 'L',
  P = 'P',
}

export enum MaritalStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
}

// --- SUB-DTO: PERSONAL INFO ---
// Validasi untuk object userProfile dan spouseProfile
export class PersonalInfoDto {
  @IsString()
  name: string;

  @IsDateString()
  dob: string; // Format YYYY-MM-DD

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  ethnicity: string;

  @IsString()
  religion: string;

  @IsEnum(MaritalStatus)
  maritalStatus: MaritalStatus;

  @IsNumber()
  @Min(0)
  childrenCount: number;

  @IsNumber()
  @Min(0)
  dependentParents: number;

  @IsString()
  occupation: string;

  @IsString()
  city: string;
}

// --- MAIN DTO: FINANCIAL RECORD ---
export class CreateFinancialRecordDto {
  // 1. METADATA PROFIL
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  userProfile: PersonalInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  spouseProfile?: PersonalInfoDto;

  // 2. NERACA ASET (HARTA)
  
  // A. Aset Likuid
  @IsNumber() @Min(0) assetCash: number;

  // B. Aset Personal
  @IsNumber() @Min(0) assetHome: number;
  @IsNumber() @Min(0) assetVehicle: number;
  @IsNumber() @Min(0) assetJewelry: number;
  @IsNumber() @Min(0) assetAntique: number;
  @IsNumber() @Min(0) assetPersonalOther: number;

  // C. Aset Investasi
  @IsNumber() @Min(0) assetInvHome: number;
  @IsNumber() @Min(0) assetInvVehicle: number;
  @IsNumber() @Min(0) assetGold: number;
  @IsNumber() @Min(0) assetInvAntique: number;
  @IsNumber() @Min(0) assetStocks: number;
  @IsNumber() @Min(0) assetMutualFund: number;
  @IsNumber() @Min(0) assetBonds: number;
  @IsNumber() @Min(0) assetDeposit: number;
  @IsNumber() @Min(0) assetInvOther: number;

  // 3. NERACA UTANG (KEWAJIBAN) - Sisa Pokok

  // E. Utang Konsumtif
  @IsNumber() @Min(0) debtKPR: number;
  @IsNumber() @Min(0) debtKPM: number;
  @IsNumber() @Min(0) debtCC: number;
  @IsNumber() @Min(0) debtCoop: number;
  @IsNumber() @Min(0) debtConsumptiveOther: number;

  // F. Utang Usaha
  @IsNumber() @Min(0) debtBusiness: number;

  // 4. ARUS KAS (CASHFLOW) - PER TAHUN

  // I. Pemasukan
  @IsNumber() @Min(0) incomeFixed: number;
  @IsNumber() @Min(0) incomeVariable: number;

  // --- PENGELUARAN (Input Raw dari FE) ---

  // K. Cicilan Utang
  @IsNumber() @Min(0) installmentKPR: number;
  @IsNumber() @Min(0) installmentKPM: number;
  @IsNumber() @Min(0) installmentCC: number;
  @IsNumber() @Min(0) installmentCoop: number;
  @IsNumber() @Min(0) installmentConsumptiveOther: number;
  @IsNumber() @Min(0) installmentBusiness: number;

  // L. Premi Asuransi
  @IsNumber() @Min(0) insuranceLife: number;
  @IsNumber() @Min(0) insuranceHealth: number;
  @IsNumber() @Min(0) insuranceHome: number;
  @IsNumber() @Min(0) insuranceVehicle: number;
  @IsNumber() @Min(0) insuranceBPJS: number;
  @IsNumber() @Min(0) insuranceOther: number;

  // M. Tabungan/Investasi
  @IsNumber() @Min(0) savingEducation: number;
  @IsNumber() @Min(0) savingRetirement: number;
  @IsNumber() @Min(0) savingPilgrimage: number;
  @IsNumber() @Min(0) savingHoliday: number;
  @IsNumber() @Min(0) savingEmergency: number;
  @IsNumber() @Min(0) savingOther: number;

  // N. Belanja Keluarga
  @IsNumber() @Min(0) expenseFood: number;
  @IsNumber() @Min(0) expenseSchool: number;
  @IsNumber() @Min(0) expenseTransport: number;
  @IsNumber() @Min(0) expenseCommunication: number;
  @IsNumber() @Min(0) expenseHelpers: number;
  @IsNumber() @Min(0) expenseTax: number;
  @IsNumber() @Min(0) expenseLifestyle: number;
}