import defaultBank from "../Assets/Banks/defaultBank.svg";
import sbi from "../Assets/Banks/sbi.svg";
import hdfc from "../Assets/Banks/hdfc.svg";
import icici from "../Assets/Banks/icici.svg";
import axis from "../Assets/Banks/axis.svg";
import pnb from "../Assets/Banks/pnb.svg";
import bob from "../Assets/Banks/bob.svg";
import canara from "../Assets/Banks/canara.svg";
import union from "../Assets/Banks/union.svg";
import bom from "../Assets/Banks/bom.svg";
import kotak from "../Assets/Banks/kotak.svg";
import yes from "../Assets/Banks/yes.svg";
import idbi from "../Assets/Banks/idbi.svg";
import federal from "../Assets/Banks/federal.svg";
import sib from "../Assets/Banks/sib.svg";
import karnataka from "../Assets/Banks/karnataka.svg";
import bandhan from "../Assets/Banks/bandhan.svg";
import indusind from "../Assets/Banks/indusind.svg";
import rbl from "../Assets/Banks/rbl.svg";
import idfc from "../Assets/Banks/idfc.svg";
import indian from "../Assets/Banks/indian.svg";
import overseas from "../Assets/Banks/overseas.svg";
import central from "../Assets/Banks/central.svg";
import uco from "../Assets/Banks/uco.svg";
import nainital from "../Assets/Banks/nainital.svg";
import boi from "../Assets/Banks/boi.svg";

export const BANK_LOGO_MAP = {
  SBIN: sbi,
  HDFC: hdfc,
  ICIC: icici,
  UTIB: axis,
  PUNB: pnb,
  BARB: bob,
  CNRB: canara,
  UBIN: union,
  MAHB: bom,
  KKBK: kotak,
  YESB: yes,
  IBKL: idbi,
  FDRL: federal,
  SIBL: sib,
  KARB: karnataka,
  BDBL: bandhan,
  INDB: indusind,
  RATN: rbl,
  IDFB: idfc,
  IDIB: indian,
  IOBA: overseas,
  CBIN: central,
  UCBA: uco,
  NTBL: nainital,
  BKID: boi,
};

/** Default fallback logo for banks without a dedicated SVG asset. */
export { defaultBank };

/**
 * Get the bank logo for a given IFSC code.
 * Falls back to the default bank image if no mapped logo is found.
 *
 * @param {string} ifscCode - Full IFSC code (e.g. "SBIN0001234") or just the prefix (e.g. "SBIN")
 * @returns {string} - The logo import (always non-null; returns defaultBank as fallback)
 */
export const getBankLogo = (ifscCode) => {
  if (!ifscCode) return defaultBank;
  const prefix = ifscCode.slice(0, 4).toUpperCase();
  return BANK_LOGO_MAP[prefix] || defaultBank;
};