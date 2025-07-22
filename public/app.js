// Token Management
const setToken = (token) => {
    localStorage.setItem('token', token);
};

const getToken = () => {
    return localStorage.getItem('token');
};

const removeToken = () => {
    localStorage.removeItem('token');
};

const stripe = Stripe('pk_test_51RlCIlRsgw1TtoM0FHCH5nrRtwCd4Z0gZswESJknzocF5M93YWNDiL8W3ybqhIuxD5dwMnMLjG4EAUcXwe35uljz003uYXUWUo');
const elements = stripe.elements();
const card = elements.create('card');
card.mount('#card-element');

// Single payment form handler
document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: card,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const token = getToken();
    if (!token) {
      alert('Please login first');
      loginModal.style.display = 'block';
      return;
    }

    const response = await fetch('/api/payments/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: parseFloat(document.getElementById('amount').value),
        paymentMethodId: paymentMethod.id
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      document.getElementById('paymentForm').reset();
      card.clear();
      await loadTransactionHistory();
      alert('Payment Successful!');
    } else {
      throw new Error(data.msg || 'Payment failed');
    }
  } catch (err) {
    console.error('Payment error:', err);
    alert(err.message || 'Payment failed. Please try again.');
  }
});

// Modal Management
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const closeBtns = document.getElementsByClassName('close');

// Show Modals
loginBtn.onclick = () => loginModal.style.display = 'block';
registerBtn.onclick = () => registerModal.style.display = 'block';

// Close Modals
Array.from(closeBtns).forEach(btn => {
    btn.onclick = function() {
        loginModal.style.display = 'none';
        registerModal.style.display = 'none';
    }
});

window.onclick = (event) => {
    if (event.target == loginModal || event.target == registerModal) {
        loginModal.style.display = 'none';
        registerModal.style.display = 'none';
    }
};

// Form Submissions
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const registerButton = e.target.querySelector('button[type="submit"]');
    registerButton.disabled = true;
    registerButton.textContent = 'Registering...';
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                full_name: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPassword').value
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            setToken(data.token);
            registerModal.style.display = 'none';
            document.getElementById('registerForm').reset();
            alert('Registration successful!');
            location.reload();
        } else {
            alert(data.msg || 'Registration failed. Please try again.');
        }
    } catch (err) {
        console.error('Registration error:', err);
        alert('Registration failed. Please check your connection and try again.');
    } finally {
        registerButton.disabled = false;
        registerButton.textContent = 'Register';
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const loginButton = e.target.querySelector('button[type="submit"]');
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            setToken(data.token);
            loginModal.style.display = 'none';
            document.getElementById('loginForm').reset();
            alert('Login successful!');
            location.reload();
        } else {
            alert(data.msg || 'Login failed. Please check your credentials.');
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('Login failed. Please check your connection and try again.');
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});

// Load Transaction History
// Transaction History Loading Function
async function loadTransactionHistory() {
    const token = getToken();
    if (!token) return;

    try {
        const response = await fetch('/api/payments/history', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const transactions = await response.json();
        const transactionList = document.querySelector('.transaction-list');
        
        transactionList.innerHTML = transactions.map(tx => `
            <div class="transaction-item" style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                <div class="transaction-info">
                    <p><strong>Amount:</strong> $${tx.amount}</p>
                    <p><strong>Card:</strong> ${tx.card_brand} **** **** **** ${tx.card_last_four}</p>
                    <p><strong>Status:</strong> ${tx.status}</p>
                    <p><strong>Date:</strong> ${new Date(tx.created_at).toLocaleString()}</p>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('History error:', err);
    }
}

// Load history when page loads
document.addEventListener('DOMContentLoaded', loadTransactionHistory);

// Initial load
loadTransactionHistory();