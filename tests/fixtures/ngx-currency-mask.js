/**
 * Porte fiel da máscara de moeda do portal Caixa Escolar MG.
 *
 * Extraído de research/portal/chunk-CWW7GISC.js (classes minificadas Nr/kr/Or,
 * ngx-currency) e apenas renomeado/desminificado. A lógica é a mesma, de
 * propósito: o teste do motor de preenchimento vale exatamente porque a máscara
 * aqui reage como a do portal — inclusive ignorando `input.value = "6,90"`.
 *
 * Os host listeners (keydown/keypress/keyup/click) são os mesmos que a diretiva
 * registra no elemento.
 */

class InputManager {
  constructor(htmlInputElement) {
    this.htmlInputElement = htmlInputElement;
  }

  setCursorAt(position) {
    if (this.htmlInputElement.setSelectionRange) {
      this.htmlInputElement.focus();
      this.htmlInputElement.setSelectionRange(position, position);
    }
  }

  updateValueAndCursor(newValue, oldLength, cursor) {
    this.rawValue = newValue;
    const newLength = newValue.length;
    this.setCursorAt(cursor - (oldLength - newLength));
  }

  get canInputMoreNumbers() {
    const maxLength = this.htmlInputElement.maxLength;
    const underMax = !(this.rawValue.length >= maxLength && maxLength >= 0);
    const { selectionStart, selectionEnd } = this.inputSelection;
    const hasDigitSelected = Boolean(
      selectionStart !== selectionEnd &&
        this.htmlInputElement.value.substring(selectionStart, selectionEnd).match(/\d/)
    );
    const startsWithZero = this.htmlInputElement.value.substring(0, 1) === "0";
    return underMax || hasDigitSelected || startsWithZero;
  }

  get inputSelection() {
    return {
      selectionStart: this.htmlInputElement.selectionStart ?? 0,
      selectionEnd: this.htmlInputElement.selectionEnd ?? 0
    };
  }

  get rawValue() {
    return this.htmlInputElement && this.htmlInputElement.value;
  }

  set rawValue(value) {
    this._storedRawValue = value;
    if (this.htmlInputElement) this.htmlInputElement.value = value;
  }

  get storedRawValue() {
    return this._storedRawValue;
  }
}

class InputService {
  constructor(htmlInputElement, options) {
    this.htmlInputElement = htmlInputElement;
    this.options = options;
    this.inputManager = new InputManager(htmlInputElement);
  }

  addNumber(keyCode) {
    if (!this.rawValue) this.rawValue = this.applyMask(false, "0");
    const char = String.fromCharCode(keyCode);
    const { selectionStart, selectionEnd } = this.inputSelection;
    this.rawValue =
      this.rawValue.substring(0, selectionStart) + char + this.rawValue.substring(selectionEnd, this.rawValue.length);
    this.updateFieldValue(selectionStart + 1);
  }

  applyMask(fixPrecision, value) {
    const { allowNegative, decimal, precision, prefix, suffix, thousands } = this.options;
    const source = fixPrecision ? new Number(value).toFixed(precision) : value;
    const digits = source.replace(/[^0-9]/g, "");
    if (!digits) return "";

    let integer = digits
      .slice(0, digits.length - precision)
      .replace(/^0*/g, "")
      .replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    if (integer === "") integer = "0";

    let out = integer;
    let cents = digits.slice(digits.length - precision);
    if (precision > 0) {
      cents = "0".repeat(precision - cents.length) + cents;
      out += decimal + cents;
    }

    const isZero = parseInt(integer, 10) === 0 && (parseInt(cents, 10) === 0 || cents === "");
    return (source.indexOf("-") > -1 && allowNegative && !isZero ? "-" : "") + prefix + out + suffix;
  }

  clearMask(value) {
    if (value == null || value === "") return null;
    let clean = value.replace(this.options.prefix, "").replace(this.options.suffix, "");
    if (this.options.thousands) clean = clean.replace(new RegExp("\\" + this.options.thousands, "g"), "");
    if (this.options.decimal) clean = clean.replace(this.options.decimal, ".");
    return parseFloat(clean);
  }

  fixCursorPosition(forceEnd) {
    const start = this.inputSelection.selectionStart;
    if (start > this.getRawValueWithoutSuffixEndPosition() || forceEnd) {
      this.inputManager.setCursorAt(this.getRawValueWithoutSuffixEndPosition());
    } else if (start < this.getRawValueWithoutPrefixStartPosition()) {
      this.inputManager.setCursorAt(this.getRawValueWithoutPrefixStartPosition());
    }
  }

  getRawValueWithoutSuffixEndPosition() {
    return this.rawValue.length - this.options.suffix.length;
  }

  getRawValueWithoutPrefixStartPosition() {
    return this.value != null && this.value < 0 ? this.options.prefix.length + 1 : this.options.prefix.length;
  }

  removeNumber(keyCode) {
    const { decimal, thousands } = this.options;
    let end = this.inputSelection.selectionEnd;
    let start = this.inputSelection.selectionStart;

    if (start > this.rawValue.length - this.options.suffix.length) {
      end = this.rawValue.length - this.options.suffix.length;
      start = this.rawValue.length - this.options.suffix.length;
    }

    if (end === start) {
      if (keyCode === 8 && /^\d+$/.test(this.rawValue.substring(start - 1, end))) start = start - 1;
      if (keyCode === 8 && (this.rawValue.substring(start - 1, end) === decimal || this.rawValue.substring(start - 1, end) === thousands)) {
        start = start - 2;
        end = end - 1;
      }
    }

    this.rawValue = this.rawValue.substring(0, start) + this.rawValue.substring(end, this.rawValue.length);
    this.updateFieldValue(start);
  }

  updateFieldValue(cursor) {
    const masked = this.applyMask(false, this.rawValue || "");
    const position = cursor ?? this.rawValue.length;
    this.inputManager.updateValueAndCursor(masked, this.rawValue.length, position);
  }

  get canInputMoreNumbers() {
    return this.inputManager.canInputMoreNumbers;
  }

  get inputSelection() {
    return this.inputManager.inputSelection;
  }

  get rawValue() {
    return this.inputManager.rawValue;
  }

  set rawValue(value) {
    this.inputManager.rawValue = value;
  }

  get storedRawValue() {
    return this.inputManager.storedRawValue;
  }

  get value() {
    return this.clearMask(this.rawValue);
  }

  set value(value) {
    this.rawValue = this.applyMask(true, "" + value);
  }
}

class InputHandler {
  constructor(htmlInputElement, options) {
    this.inputService = new InputService(htmlInputElement, options);
    this.htmlInputElement = htmlInputElement;
    this.onModelChange = () => {};
  }

  isReadOnly() {
    return this.htmlInputElement.readOnly;
  }

  setValue(value) {
    this.inputService.value = value;
  }

  handleClick() {
    const { selectionStart, selectionEnd } = this.inputService.inputSelection;
    if (Math.abs(selectionEnd - selectionStart) === 0 && !isNaN(this.inputService.value)) {
      this.inputService.fixCursorPosition();
    }
  }

  handleKeydown(event) {
    if (this.isReadOnly()) return;
    const code = event.which || event.charCode || event.keyCode;
    if (code !== 8 && code !== 46 && code !== 63272) return;

    event.preventDefault();
    const selectionSize = Math.abs(
      this.inputService.inputSelection.selectionEnd - this.inputService.inputSelection.selectionStart
    );

    if (selectionSize === this.inputService.rawValue.length || this.inputService.value === 0) {
      this.setValue(null);
      this.onModelChange(this.inputService.value);
    }
    if (selectionSize === 0 && !isNaN(this.inputService.value)) {
      this.inputService.removeNumber(code);
      this.onModelChange(this.inputService.value);
    }
    if ((code === 8 || code === 46) && selectionSize !== 0 && !isNaN(this.inputService.value)) {
      this.inputService.removeNumber(code);
      this.onModelChange(this.inputService.value);
    }
  }

  handleKeypress(event) {
    if (this.isReadOnly()) return;
    const code = event.which || event.charCode || event.keyCode;
    if (code == null || [9, 13].indexOf(code) !== -1) return;

    if (code === 43) this.inputService.changeToPositive?.();
    else if (code === 45) this.inputService.changeToNegative?.();
    else if (
      this.inputService.canInputMoreNumbers &&
      (!isNaN(this.inputService.value) || String.fromCharCode(code).match(/\d/) != null)
    ) {
      this.inputService.addNumber(code);
    }

    event.preventDefault();
    this.onModelChange(this.inputService.value);
  }

  handleKeyup() {
    this.inputService.fixCursorPosition();
  }
}

const DEFAULT_OPTIONS = {
  align: "right",
  allowNegative: false,
  decimal: ",",
  precision: 2,
  prefix: "R$ ",
  suffix: "",
  thousands: "."
};

/** Liga a máscara no input como a diretiva do portal faz. */
export function attachCurrencyMask(input, { onModelChange = () => {}, options = {} } = {}) {
  const handler = new InputHandler(input, { ...DEFAULT_OPTIONS, ...options });
  handler.onModelChange = onModelChange;
  input.addEventListener("click", (event) => handler.handleClick(event));
  input.addEventListener("keydown", (event) => handler.handleKeydown(event));
  input.addEventListener("keypress", (event) => handler.handleKeypress(event));
  input.addEventListener("keyup", (event) => handler.handleKeyup(event));
  return handler;
}

export function formatBRL(value) {
  if (value == null || Number.isNaN(value)) return "R$ 0,00";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
