//done with the footer
const footer=document.querySelector('footer');
const date=new Date().getFullYear();
footer.innerHTML=`&copy; ${date} CyberFreeWifi. All rights reserved.`
// made cards selectable
const plans=document.querySelectorAll(".package");
plans.forEach(pkg=>{
    pkg.addEventListener('click',(event)=>{
        plans.forEach(pkd=>{pkd.classList.remove('active');})
        pkg.classList.add('active');
    })
});
// get No
const form = document.getElementById('wifi');
if(form){
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const phone = document.getElementById('phone').value.trim();
        const active = document.querySelector('.package.active');
        
        if (!active) {
            alert('Please select a package first!');
            return;
        }
    
    
        const planName = active.querySelector('h4').textContent.trim();
        const planPrice = active.querySelector('p').textContent.trim();
        console.log(`Sending to Server: ${planName} && Price: ${planPrice}`);
        
        const payButton = document.getElementById('paybutton');
        const originalText = payButton.textContent;
        
        payButton.disabled = true;
        payButton.textContent = "Sending STK Push...";
    
        try {
            const clientMac =window.clientMac||"UNKOWN"
            console.log();
            
            const response = await fetch('https://billingsystem-v6r7.onrender.com/pay', {
                method: "POST",
                mode: 'cors',
                headers: {
                    'Content-Type': "application/json"
                },
                body: JSON.stringify({ "phone": phone, "planName": planName,macAddress: clientMac, "planPrice": planPrice })
            });
    
            const result = await response.json();
            console.log(result);
    
            if (!result.success || !result.checkoutRequestId) {
                throw new Error(result.error || "Failed to initiate payment");
            }
            payButton.textContent = "Check your phone for PIN prompt...";
            if (result.success && result.checkoutRequestId) {
              alert("STK push sent! Please enter your M-Pesa PIN on your phone.");
    
    const checkoutId = result.checkoutRequestId;

    // Start polling the server every 3 seconds to check if payment cleared
    const pollInterval = setInterval(async () => {
        try {
            const statusRes = await fetch(`https://billingsystem-v6r7.onrender.com/status/${checkoutId}`);
            const statusData = await statusRes.json();

            if (statusData.success && statusData.status === 'SUCCESS') {
                clearInterval(pollInterval); // Stop polling
                alert("Payment successful! Connecting to internet...");
                
                // Reload or redirect to trigger the router's bypass
                window.location.reload(); 
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, 3000); // Checks every 3 seconds
            }else{  payButton.disabled = false;
            payButton.textContent = originalText;}
        } catch (err) {
            console.error(err);
            payButton.disabled = false;
            payButton.textContent = originalText;
            alert(err.message || "An error occurred while processing payment.");
        }
    });
}
const tbody=document.querySelector('tbody');
if(tbody){
        // Optional: Filter by client MAC if available, or fetch all recent ones
        const clientMac = window.clientMac || '';
const url = `https://billingsystem-v6r7.onrender.com/transactions?mac=${clientMac}`;

fetch(url)
    .then(res => res.json())
    .then(data => {
        const tbody = document.querySelector('table tbody');
        
        // 🔍 DEBUG: Check what your browser console sees
        console.log("API Response Object:", data);

        // ✅ CRITICAL CHECK: Access 'data.sessions' because the array lives inside it
        if (data.success && data.sessions && data.sessions.length > 0) {
            let rowsHtml = '';
            
            data.sessions.forEach(session => {
                const dateObj = new Date(session.createdAt);
                
                const event = `Package: ${session.planName}`;
                const description = `Receipt: ${session.mpesaReceiptNumber || 'Pending'} (${session.phoneNumber})`;
                const dateStr = dateObj.toLocaleDateString();
                const timeStr = dateObj.toLocaleTimeString();
                const status = session.status; 
                const action = status === 'SUCCESS' ? 'Connected' : (status === 'EXPIRED' ? 'Expired' : 'Processing');

                rowsHtml += `
                    <tr>
                        <td>${event}</td>
                        <td>${description}</td>
                        <td>${dateStr}</td>
                        <td>${timeStr}</td>
                        <td>${status}</td>
                        <td>${action}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = rowsHtml;
        } else {
            // This fallback runs if data.sessions is empty or undefined
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No transaction records found</td></tr>`;
        }
    })
    .catch(err => console.error('Error fetching transactions:', err));
}
