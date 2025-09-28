import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, buffCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_DRUG_NAME = 101;
const ERR_INVALID_CATEGORY = 102;
const ERR_INVALID_SPEC_HASH = 103;
const ERR_DRUG_ALREADY_EXISTS = 104;
const ERR_DRUG_NOT_FOUND = 105;
const ERR_AUTHORITY_NOT_VERIFIED = 107;
const ERR_INVALID_UPDATE_PARAM = 109;
const ERR_MAX_DRUGS_EXCEEDED = 110;
const ERR_INVALID_DOSAGE_FORM = 112;
const ERR_INVALID_MANUFACTURER = 113;
const ERR_INVALID_APPROVAL_DATE = 114;
const ERR_INVALID_EXPIRY_DATE = 115;
const ERR_INVALID_ATC_CODE = 116;
const ERR_INVALID_INDICATION = 117;
const ERR_INVALID_CONTRAINDICATION = 118;
const ERR_INVALID_SIDE_EFFECTS = 119;
const ERR_INVALID_VERSION = 120;

interface Drug {
  name: string;
  category: string;
  specHash: Uint8Array;
  timestamp: number;
  creator: string;
  status: boolean;
  dosageForm: string;
  manufacturer: string;
  approvalDate: number;
  expiryDate: number;
  atcCode: string;
  indication: string;
  contraindication: string;
  sideEffects: string;
  version: number;
}

interface DrugUpdate {
  updateName: string;
  updateCategory: string;
  updateTimestamp: number;
  updater: string;
  updateVersion: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class DrugRegistryMock {
  state: {
    nextDrugId: number;
    maxDrugs: number;
    registrationFee: number;
    authorityContract: string | null;
    drugs: Map<number, Drug>;
    drugUpdates: Map<number, DrugUpdate>;
    drugsByName: Map<string, number>;
  } = {
    nextDrugId: 0,
    maxDrugs: 100000,
    registrationFee: 100,
    authorityContract: null,
    drugs: new Map(),
    drugUpdates: new Map(),
    drugsByName: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextDrugId: 0,
      maxDrugs: 100000,
      registrationFee: 100,
      authorityContract: null,
      drugs: new Map(),
      drugUpdates: new Map(),
      drugsByName: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  addDrug(
    name: string,
    category: string,
    specHash: Uint8Array,
    dosageForm: string,
    manufacturer: string,
    approvalDate: number,
    expiryDate: number,
    atcCode: string,
    indication: string,
    contraindication: string,
    sideEffects: string,
    version: number
  ): Result<number> {
    if (this.state.nextDrugId >= this.state.maxDrugs) return { ok: false, value: ERR_MAX_DRUGS_EXCEEDED };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_DRUG_NAME };
    if (!category || category.length > 50) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (specHash.length !== 32) return { ok: false, value: ERR_INVALID_SPEC_HASH };
    if (dosageForm.length > 50) return { ok: false, value: ERR_INVALID_DOSAGE_FORM };
    if (manufacturer.length > 100) return { ok: false, value: ERR_INVALID_MANUFACTURER };
    if (approvalDate <= 0) return { ok: false, value: ERR_INVALID_APPROVAL_DATE };
    if (expiryDate <= 0) return { ok: false, value: ERR_INVALID_EXPIRY_DATE };
    if (atcCode.length > 20) return { ok: false, value: ERR_INVALID_ATC_CODE };
    if (indication.length > 500) return { ok: false, value: ERR_INVALID_INDICATION };
    if (contraindication.length > 500) return { ok: false, value: ERR_INVALID_CONTRAINDICATION };
    if (sideEffects.length > 1000) return { ok: false, value: ERR_INVALID_SIDE_EFFECTS };
    if (version <= 0) return { ok: false, value: ERR_INVALID_VERSION };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.drugsByName.has(name)) return { ok: false, value: ERR_DRUG_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextDrugId;
    const drug: Drug = {
      name,
      category,
      specHash,
      timestamp: this.blockHeight,
      creator: this.caller,
      status: true,
      dosageForm,
      manufacturer,
      approvalDate,
      expiryDate,
      atcCode,
      indication,
      contraindication,
      sideEffects,
      version,
    };
    this.state.drugs.set(id, drug);
    this.state.drugsByName.set(name, id);
    this.state.nextDrugId++;
    return { ok: true, value: id };
  }

  getDrug(id: number): Drug | null {
    return this.state.drugs.get(id) || null;
  }

  updateDrug(id: number, updateName: string, updateCategory: string, updateVersion: number): Result<boolean> {
    const drug = this.state.drugs.get(id);
    if (!drug) return { ok: false, value: false };
    if (drug.creator !== this.caller) return { ok: false, value: false };
    if (!updateName || updateName.length > 100) return { ok: false, value: false };
    if (!updateCategory || updateCategory.length > 50) return { ok: false, value: false };
    if (updateVersion <= drug.version) return { ok: false, value: false };
    if (this.state.drugsByName.has(updateName) && this.state.drugsByName.get(updateName) !== id) {
      return { ok: false, value: false };
    }

    const updated: Drug = {
      ...drug,
      name: updateName,
      category: updateCategory,
      timestamp: this.blockHeight,
      version: updateVersion,
    };
    this.state.drugs.set(id, updated);
    this.state.drugsByName.delete(drug.name);
    this.state.drugsByName.set(updateName, id);
    this.state.drugUpdates.set(id, {
      updateName,
      updateCategory,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateVersion,
    });
    return { ok: true, value: true };
  }

  getDrugCount(): Result<number> {
    return { ok: true, value: this.state.nextDrugId };
  }

  checkDrugExistence(name: string): Result<boolean> {
    return { ok: true, value: this.state.drugsByName.has(name) };
  }
}

describe("DrugRegistry", () => {
  let contract: DrugRegistryMock;

  beforeEach(() => {
    contract = new DrugRegistryMock();
    contract.reset();
  });

  it("adds a drug successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(32).fill(1);
    const result = contract.addDrug(
      "Aspirin",
      "Analgesic",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea, stomach pain",
      1
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const drug = contract.getDrug(0);
    expect(drug?.name).toBe("Aspirin");
    expect(drug?.category).toBe("Analgesic");
    expect(drug?.dosageForm).toBe("Tablet");
    expect(drug?.manufacturer).toBe("Bayer");
    expect(drug?.approvalDate).toBe(1234567890);
    expect(drug?.expiryDate).toBe(2345678901);
    expect(drug?.atcCode).toBe("B01AC06");
    expect(drug?.indication).toBe("Pain relief");
    expect(drug?.contraindication).toBe("Bleeding disorders");
    expect(drug?.sideEffects).toBe("Nausea, stomach pain");
    expect(drug?.version).toBe(1);
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate drug names", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(32).fill(1);
    contract.addDrug(
      "Aspirin",
      "Analgesic",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea, stomach pain",
      1
    );
    const result = contract.addDrug(
      "Aspirin",
      "Painkiller",
      new Uint8Array(32).fill(2),
      "Capsule",
      "Pfizer",
      1234567891,
      2345678902,
      "B01AC07",
      "Headache relief",
      "Allergies",
      "Dizziness",
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DRUG_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const specHash = new Uint8Array(32).fill(1);
    const result = contract.addDrug(
      "Ibuprofen",
      "NSAID",
      specHash,
      "Tablet",
      "Advil",
      1234567890,
      2345678901,
      "M01AE01",
      "Anti-inflammatory",
      "Stomach ulcers",
      "Heartburn",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects addition without authority contract", () => {
    const specHash = new Uint8Array(32).fill(1);
    const result = contract.addDrug(
      "Paracetamol",
      "Analgesic",
      specHash,
      "Syrup",
      "Tylenol",
      1234567890,
      2345678901,
      "N02BE01",
      "Fever reduction",
      "Liver disease",
      "Jaundice",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid drug name", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(32).fill(1);
    const result = contract.addDrug(
      "",
      "Analgesic",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DRUG_NAME);
  });

  it("rejects invalid category", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(32).fill(1);
    const result = contract.addDrug(
      "Aspirin",
      "",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("rejects invalid spec hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(31).fill(1);
    const result = contract.addDrug(
      "Aspirin",
      "Analgesic",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SPEC_HASH);
  });

  it("updates a drug successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(32).fill(1);
    contract.addDrug(
      "OldDrug",
      "OldCategory",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea",
      1
    );
    const result = contract.updateDrug(0, "NewDrug", "NewCategory", 2);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const drug = contract.getDrug(0);
    expect(drug?.name).toBe("NewDrug");
    expect(drug?.category).toBe("NewCategory");
    expect(drug?.version).toBe(2);
    const update = contract.state.drugUpdates.get(0);
    expect(update?.updateName).toBe("NewDrug");
    expect(update?.updateCategory).toBe("NewCategory");
    expect(update?.updateVersion).toBe(2);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent drug", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateDrug(99, "NewDrug", "NewCategory", 2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(32).fill(1);
    contract.addDrug(
      "TestDrug",
      "Category",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea",
      1
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateDrug(0, "NewDrug", "NewCategory", 2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(200);
    const specHash = new Uint8Array(32).fill(1);
    contract.addDrug(
      "TestDrug",
      "Category",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea",
      1
    );
    expect(contract.stxTransfers).toEqual([{ amount: 200, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects registration fee change without authority contract", () => {
    const result = contract.setRegistrationFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct drug count", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash1 = new Uint8Array(32).fill(1);
    const specHash2 = new Uint8Array(32).fill(2);
    contract.addDrug(
      "Drug1",
      "Cat1",
      specHash1,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding",
      "Nausea",
      1
    );
    contract.addDrug(
      "Drug2",
      "Cat2",
      specHash2,
      "Capsule",
      "Pfizer",
      1234567891,
      2345678902,
      "M01AE01",
      "Anti-inflammatory",
      "Ulcers",
      "Heartburn",
      1
    );
    const result = contract.getDrugCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks drug existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(32).fill(1);
    contract.addDrug(
      "TestDrug",
      "Category",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding disorders",
      "Nausea",
      1
    );
    const result = contract.checkDrugExistence("TestDrug");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkDrugExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects addition with empty name", () => {
    contract.setAuthorityContract("ST2TEST");
    const specHash = new Uint8Array(32).fill(1);
    const result = contract.addDrug(
      "",
      "Category",
      specHash,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding",
      "Nausea",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DRUG_NAME);
  });

  it("rejects addition with max drugs exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxDrugs = 1;
    const specHash1 = new Uint8Array(32).fill(1);
    contract.addDrug(
      "Drug1",
      "Cat1",
      specHash1,
      "Tablet",
      "Bayer",
      1234567890,
      2345678901,
      "B01AC06",
      "Pain relief",
      "Bleeding",
      "Nausea",
      1
    );
    const specHash2 = new Uint8Array(32).fill(2);
    const result = contract.addDrug(
      "Drug2",
      "Cat2",
      specHash2,
      "Capsule",
      "Pfizer",
      1234567891,
      2345678902,
      "M01AE01",
      "Anti-inflammatory",
      "Ulcers",
      "Heartburn",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_DRUGS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});