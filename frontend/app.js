/**
 * AeroVerify - Core Frontend Application Logic
 * Integrates with Hono backend (Cloudflare Worker)
 */

// --- CONFIGURATION ---
const BACKEND_URL = 'http://localhost:8787';

// --- DOM ELEMENTS ---
// Steps/Views
const stepEmail = document.getElementById('step-email');
const stepOtp = document.getElementById('step-otp');
const stepSuccess = document.getElementById('step-success');

// Forms & Inputs
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('email-input');
const btnClearEmail = document.getElementById('btn-clear-email');
const emailError = document.getElementById('email-error');

const otpForm = document.getElementById('otp-form');
const otpInputs = Array.from(document.querySelectorAll('.otp-input'));
const otpTimer = document.getElementById('otp-timer');
const otpError = document.getElementById('otp-error');
const displayEmail = document.getElementById('display-email');

// Buttons & Spinners
const btnSendOtp = document.getElementById('btn-send-otp');
const spinnerSend = document.getElementById('spinner-send');

const btnVerifyOtp = document.getElementById('btn-verify-otp');
const spinnerVerify = document.getElementById('spinner-verify');

const btnResendOtp = document.getElementById('btn-resend-otp');
const resendTimerSpan = document.getElementById('resend-timer-span');
const btnBackEmail = document.getElementById('btn-back-email');
const btnRestart = document.getElementById('btn-restart');

// Container
const toastContainer = document.getElementById('toast-container');
const verificationCard = document.getElementById('verification-card');

// --- APP STATE ---
let state = {
  email: '',
  timerInterval: null,
  secondsRemaining: 0,
  isTimerRunning: false,
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupOtpInputHandlers();
});

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Email Form Events
  emailForm.addEventListener('submit', handleEmailSubmit);
  emailInput.addEventListener('input', handleEmailInput);
  btnClearEmail.addEventListener('click', clearEmailInput);

  // OTP Form Events
  otpForm.addEventListener('submit', handleOtpSubmit);
  btnResendOtp.addEventListener('click', handleResendOtp);
  btnBackEmail.addEventListener('click', handleBackToEmail);

  // Success Event
  btnRestart.addEventListener('click', resetApp);
}

// --- NAVIGATION SYSTEM ---
function navigateToStep(targetStep) {
  const allSteps = [stepEmail, stepOtp, stepSuccess];
  
  // Add active state to verification card for transition effect
  verificationCard.style.transform = 'scale(0.98)';
  setTimeout(() => {
    verificationCard.style.transform = 'none';
  }, 200);

  allSteps.forEach(step => {
    if (step === targetStep) {
      step.classList.add('active');
    } else {
      step.classList.remove('active');
    }
  });
}

// --- EMAIL INPUT BUSINESS LOGIC ---
function handleEmailInput() {
  // Toggle the Clear Button
  if (emailInput.value.trim().length > 0) {
    btnClearEmail.style.display = 'flex';
  } else {
    btnClearEmail.style.display = 'none';
  }

  // Remove error outline once user starts fixing their input
  emailInput.style.borderColor = '';
  emailInput.style.boxShadow = '';
  emailError.style.display = 'none';
}

function clearEmailInput() {
  emailInput.value = '';
  btnClearEmail.style.display = 'none';
  emailInput.focus();
  handleEmailInput();
}

function validateEmail(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email.trim());
}

async function handleEmailSubmit(e) {
  e.preventDefault();
  const emailVal = emailInput.value.trim();

  if (!validateEmail(emailVal)) {
    emailInput.style.borderColor = 'var(--color-error)';
    emailInput.style.boxShadow = '0 0 0 4px var(--color-error-glow)';
    emailError.style.display = 'flex';
    showToast('Vui lòng nhập địa chỉ email hợp lệ.', 'error');
    return;
  }

  // Set visual loading state
  setLoadingState(true, btnSendOtp, spinnerSend, emailInput);

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: emailVal }),
    });

    const data = await response.json();

    if (response.ok) {
      state.email = emailVal;
      displayEmail.textContent = maskEmail(emailVal);
      
      showToast('Gửi OTP thành công! Vui lòng kiểm tra email.', 'success');
      
      // Reset OTP values & Navigate to Step 2
      otpInputs.forEach(input => {
        input.value = '';
        input.classList.remove('error');
      });

      navigateToStep(stepOtp);
      setTimeout(() => otpInputs[0].focus(), 400); // Focus first box after transition
      
      // Start 5-Minute (300 seconds) Countdown
      startCountdown(300);
    } else {
      showToast(data.error || 'Có lỗi xảy ra khi gửi OTP.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Không thể kết nối đến máy chủ. Vui lòng kiểm tra cổng backend (8787).', 'error');
  } finally {
    setLoadingState(false, btnSendOtp, spinnerSend, emailInput);
  }
}

// Helper: Mask email for privacy (e.g., john.doe@example.com -> jo***e@example.com)
function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (name.length <= 3) {
    return `${name[0]}***@${domain}`;
  }
  return `${name.substring(0, 2)}***${name.slice(-1)}@${domain}`;
}

// --- SPLIT OTP INPUT HANDLERS (PREMIUM UX) ---
function setupOtpInputHandlers() {
  otpInputs.forEach((input, index) => {
    // 1. Prevent typing anything except integers
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      
      // Ensure only numeric digits
      e.target.value = val.replace(/[^0-9]/g, '');
      
      // Clear error styling on input
      input.classList.remove('error');
      otpError.style.display = 'none';

      // Auto-focus next input if a number is typed
      if (e.target.value.length === 1) {
        if (index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        } else {
          // If last digit is inputted, auto-trigger verify check
          btnVerifyOtp.focus();
        }
      }
    });

    // 2. Handle specific key presses
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (input.value === '') {
          // If empty and user hits backspace, focus the previous field and empty it
          if (index > 0) {
            otpInputs[index - 1].focus();
            otpInputs[index - 1].value = '';
          }
        } else {
          // If not empty, just erase
          input.value = '';
        }
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        if (index > 0) {
          otpInputs[index - 1].focus();
        }
      } else if (e.key === 'ArrowRight') {
        if (index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
      }
    });

    // 3. Handle PASTE event (UX Delight)
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text');
      
      // Filter out non-numeric characters and trim to length 6
      const digits = pasteData.replace(/[^0-9]/g, '').slice(0, 6);
      
      if (digits.length > 0) {
        // Disperse digits across inputs starting from the current index or from the beginning
        let startIdx = 0; // Paste from first box is cleanest UX
        
        for (let i = 0; i < digits.length; i++) {
          if (startIdx + i < otpInputs.length) {
            otpInputs[startIdx + i].value = digits[i];
            otpInputs[startIdx + i].classList.remove('error');
          }
        }
        
        // Focus the appropriate input
        const nextFocusIdx = Math.min(startIdx + digits.length, otpInputs.length - 1);
        otpInputs[nextFocusIdx].focus();
        
        if (digits.length === 6) {
          btnVerifyOtp.focus();
        }
      }
    });
  });
}

// --- COUNTDOWN TIMER ---
function startCountdown(seconds) {
  clearInterval(state.timerInterval);
  state.secondsRemaining = seconds;
  state.isTimerRunning = true;
  
  // Resend code states
  btnResendOtp.disabled = true;
  btnVerifyOtp.disabled = false;

  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.secondsRemaining--;
    updateTimerDisplay();

    if (state.secondsRemaining <= 0) {
      clearInterval(state.timerInterval);
      state.isTimerRunning = false;
      
      // Enable resending OTP
      btnResendOtp.disabled = false;
      resendTimerSpan.textContent = '';
      
      // Disable verify since current code is expired
      btnVerifyOtp.disabled = true;
      showToast('Mã xác thực đã hết hạn. Vui lòng bấm gửi lại!', 'error');
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(state.secondsRemaining / 60);
  const seconds = state.secondsRemaining % 60;
  
  const minStr = String(minutes).padStart(2, '0');
  const secStr = String(seconds).padStart(2, '0');
  
  otpTimer.textContent = `${minStr}:${secStr}`;
  
  // Resend button text updates
  if (state.isTimerRunning) {
    resendTimerSpan.textContent = `(${state.secondsRemaining}s)`;
  }
  
  // Visual warning colors under 1 minute
  if (state.secondsRemaining < 60) {
    otpTimer.classList.add('warning');
  } else {
    otpTimer.classList.remove('warning');
  }
}

// --- OTP SUBMISSION & VERIFICATION ---
async function handleOtpSubmit(e) {
  e.preventDefault();
  
  // Combine individual digits
  const otpCode = otpInputs.map(input => input.value).join('');

  if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
    otpInputs.forEach(input => {
      if (input.value === '') input.classList.add('error');
    });
    otpError.style.display = 'flex';
    showToast('Vui lòng nhập đầy đủ mã OTP 6 chữ số.', 'error');
    return;
  }

  setLoadingState(true, btnVerifyOtp, spinnerVerify, ...otpInputs);

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: state.email,
        otp: otpCode,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      clearInterval(state.timerInterval);
      showToast('Xác thực danh tính thành công!', 'success');
      navigateToStep(stepSuccess);
    } else {
      // Highlight errors on all boxes and trigger shake animation
      otpInputs.forEach(input => input.classList.add('error'));
      otpError.textContent = data.detail || 'Mã OTP không chính xác hoặc đã hết hạn.';
      otpError.style.display = 'flex';
      
      showToast(otpError.textContent, 'error');
      
      // Auto-clear inputs & focus first box to try again
      setTimeout(() => {
        otpInputs.forEach(input => input.value = '');
        otpInputs[0].focus();
      }, 800);
    }
  } catch (err) {
    console.error(err);
    showToast('Kết nối bị gián đoạn. Vui lòng thử lại sau.', 'error');
  } finally {
    setLoadingState(false, btnVerifyOtp, spinnerVerify, ...otpInputs);
  }
}

// --- ACTION BUTTON ACTIONS ---
async function handleResendOtp() {
  if (state.isTimerRunning) return;
  
  btnResendOtp.disabled = true;
  resendTimerSpan.textContent = '(gửi...)';

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: state.email }),
    });

    if (response.ok) {
      showToast('Mã OTP mới đã được gửi thành công!', 'success');
      
      // Reset OTP boxes
      otpInputs.forEach(input => {
        input.value = '';
        input.classList.remove('error');
      });
      otpInputs[0].focus();
      
      // Restart 5 min timer
      startCountdown(300);
    } else {
      const data = await response.json();
      showToast(data.error || 'Có lỗi xảy ra khi gửi lại mã OTP.', 'error');
      btnResendOtp.disabled = false;
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi kết nối. Không thể gửi lại OTP.', 'error');
    btnResendOtp.disabled = false;
  }
}

function handleBackToEmail() {
  clearInterval(state.timerInterval);
  state.isTimerRunning = false;
  navigateToStep(stepEmail);
  setTimeout(() => emailInput.focus(), 400);
}

function resetApp() {
  state.email = '';
  clearInterval(state.timerInterval);
  state.isTimerRunning = false;
  
  emailInput.value = '';
  btnClearEmail.style.display = 'none';
  
  navigateToStep(stepEmail);
  setTimeout(() => emailInput.focus(), 400);
}

// --- UI LOADING STATE MANAGER ---
function setLoadingState(isLoading, btn, spinner, ...disabledInputs) {
  if (isLoading) {
    btn.disabled = true;
    spinner.style.display = 'inline-block';
    disabledInputs.forEach(input => input.disabled = true);
  } else {
    btn.disabled = false;
    spinner.style.display = 'none';
    disabledInputs.forEach(input => input.disabled = false);
  }
}

// --- TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Close message">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  // Close event listener
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });

  // Add to container
  toastContainer.appendChild(toast);

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    if (toastContainer.contains(toast)) {
      removeToast(toast);
    }
  }, 4000);
}

function removeToast(toast) {
  toast.classList.add('slide-out');
  toast.addEventListener('animationend', () => {
    toast.remove();
  });
}
