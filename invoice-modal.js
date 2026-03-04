/**
 * Módulo de facturación para integrar en el flujo de pedidos
 * Incluir en index.html y meseros.html después de app.js
 */

// HTML del modal de facturación
const invoiceModalHTML = `
<div id="invoice-modal" class="modal" style="display: none;">
    <div class="modal-content" style="max-width: 600px;">
        <span class="close" onclick="InvoiceModal.close()">&times;</span>
        <h2>📄 Generar Factura Electrónica</h2>
        
        <div id="invoice-alert" style="padding: 12px; margin-bottom: 15px; border-radius: 4px; display: none;"></div>
        
        <div id="invoice-form-container">
            <form id="invoice-customer-form">
                <h3>Datos del Cliente</h3>
                
                <div class="form-group">
                    <label>Buscar cliente existente:</label>
                    <input type="text" id="search-customer" placeholder="Número de documento" style="width: 100%; padding: 8px; margin-bottom: 10px;">
                    <button type="button" onclick="InvoiceModal.searchCustomer()" style="padding: 8px 16px;">🔍 Buscar</button>
                </div>
                
                <hr style="margin: 20px 0;">
                
                <div class="form-group">
                    <label>Nombre / Razón Social: *</label>
                    <input type="text" id="invoice-customer-name" required style="width: 100%; padding: 8px;">
                </div>
                
                <div class="form-group" style="display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <label>Tipo de Documento: *</label>
                        <select id="invoice-customer-type" required style="width: 100%; padding: 8px;">
                            <option value="CC">CC - Cédula</option>
                            <option value="NIT">NIT</option>
                            <option value="CE">CE - Extranjería</option>
                            <option value="Pasaporte">Pasaporte</option>
                        </select>
                    </div>
                    <div style="flex: 2;">
                        <label>Número de Documento: *</label>
                        <input type="text" id="invoice-customer-number" required style="width: 100%; padding: 8px;">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Email: *</label>
                    <input type="email" id="invoice-customer-email" required style="width: 100%; padding: 8px;">
                    <small style="color: #666;">Se enviará la factura a este correo</small>
                </div>
                
                <div class="form-group">
                    <label>Teléfono:</label>
                    <input type="tel" id="invoice-customer-phone" style="width: 100%; padding: 8px;">
                </div>
                
                <div class="form-group">
                    <label>Dirección:</label>
                    <input type="text" id="invoice-customer-address" style="width: 100%; padding: 8px;">
                </div>
                
                <div id="order-summary" style="background: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <!-- Se llena dinámicamente -->
                </div>
                
                <div style="text-align: right; margin-top: 20px;">
                    <button type="button" onclick="InvoiceModal.close()" style="padding: 10px 20px; margin-right: 10px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    <button type="submit" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">⚡ Generar Factura</button>
                </div>
            </form>
        </div>
    </div>
</div>

<style>
.modal {
    position: fixed;
    z-index: 9999;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0,0,0,0.5);
}

.modal-content {
    background-color: #fefefe;
    margin: 5% auto;
    padding: 20px;
    border: 1px solid #888;
    border-radius: 8px;
    max-width: 90%;
}

.close {
    color: #aaa;
    float: right;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
}

.close:hover {
    color: black;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}
</style>
`;

// Agregar el modal al DOM cuando cargue la página
document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('beforeend', invoiceModalHTML);
});

const InvoiceModal = {
    currentOrder: null,

    /**
     * Abrir modal de facturación
     */
    open(order) {
        // Verificar que la facturación esté configurada
        if (!AppState.dianConfig || !AppState.dianConfig.active) {
            alert('⚠️ La facturación electrónica no está configurada.\nVe a facturacion.html para configurarla.');
            return;
        }

        this.currentOrder = order;
        
        // Renderizar resumen del pedido
        this.renderOrderSummary();
        
        // Resetear formulario
        document.getElementById('invoice-customer-form').reset();
        
        // Mostrar modal
        document.getElementById('invoice-modal').style.display = 'block';
    },

    /**
     * Cerrar modal
     */
    close() {
        document.getElementById('invoice-modal').style.display = 'none';
        this.currentOrder = null;
    },

    /**
     * Renderizar resumen del pedido
     */
    renderOrderSummary() {
        const container = document.getElementById('order-summary');
        
        if (!this.currentOrder) {
            container.innerHTML = '<p>No hay pedido seleccionado</p>';
            return;
        }

        const itemsList = this.currentOrder.items.map(item => 
            `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${item.name} x${item.quantity}</span>
                <span>${Utils.formatCurrency(item.price * item.quantity)}</span>
            </div>`
        ).join('');

        container.innerHTML = `
            <h4 style="margin-top: 0;">Resumen del Pedido</h4>
            <div><strong>Mesa:</strong> ${this.currentOrder.tableNumber}</div>
            <div><strong>Pedido #:</strong> ${this.currentOrder.id}</div>
            <hr style="margin: 10px 0;">
            ${itemsList}
            <hr style="margin: 10px 0;">
            <div style="font-size: 18px; font-weight: bold; text-align: right;">
                TOTAL: ${Utils.formatCurrency(this.currentOrder.total)}
            </div>
        `;
    },

    /**
     * Buscar cliente existente
     */
    async searchCustomer() {
        const searchValue = document.getElementById('search-customer').value.trim();
        
        if (!searchValue) {
            this.showAlert('Por favor ingresa un número de documento', 'error');
            return;
        }

        const customer = Invoicing.findCustomerByDocument(searchValue);
        
        if (customer) {
            // Llenar el formulario con los datos del cliente
            document.getElementById('invoice-customer-name').value = customer.name;
            document.getElementById('invoice-customer-type').value = customer.identificationType;
            document.getElementById('invoice-customer-number').value = customer.identificationNumber;
            document.getElementById('invoice-customer-email').value = customer.email || '';
            document.getElementById('invoice-customer-phone').value = customer.phone || '';
            document.getElementById('invoice-customer-address').value = customer.address || '';
            
            this.showAlert('✅ Cliente encontrado', 'success');
        } else {
            this.showAlert('Cliente no encontrado. Puedes crear uno nuevo completando el formulario.', 'info');
        }
    },

    /**
     * Mostrar alerta
     */
    showAlert(message, type = 'info') {
        const alertDiv = document.getElementById('invoice-alert');
        alertDiv.style.display = 'block';
        
        const colors = {
            success: { bg: '#d4edda', text: '#155724', border: '#c3e6cb' },
            error: { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
            info: { bg: '#d1ecf1', text: '#0c5460', border: '#bee5eb' }
        };
        
        const color = colors[type] || colors.info;
        alertDiv.style.backgroundColor = color.bg;
        alertDiv.style.color = color.text;
        alertDiv.style.border = `1px solid ${color.border}`;
        alertDiv.textContent = message;
        
        // Ocultar después de 5 segundos
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    },

    /**
     * Generar factura
     */
    async generateInvoice(customerData) {
        try {
            this.showAlert('⏳ Generando factura electrónica...', 'info');

            // Crear factura
            const result = await Invoicing.createElectronicInvoice(this.currentOrder, customerData);

            this.showAlert('✅ Factura generada correctamente! Se ha enviado al email del cliente.', 'success');

            // Esperar 2 segundos y cerrar
            setTimeout(() => {
                this.close();
                
                // Recargar la página o actualizar la lista de pedidos
                if (typeof renderOrders === 'function') {
                    renderOrders();
                }
                
                // Mostrar PDF si está disponible
                if (result.pdfUrl) {
                    if (confirm('¿Deseas ver el PDF de la factura?')) {
                        window.open(result.pdfUrl, '_blank');
                    }
                }
            }, 2000);

        } catch (error) {
            console.error('Error generando factura:', error);
            this.showAlert('❌ Error generando factura: ' + error.message, 'error');
        }
    }
};

// Event listener para el formulario
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('invoice-customer-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const customerData = {
                name: document.getElementById('invoice-customer-name').value,
                identificationType: document.getElementById('invoice-customer-type').value,
                identificationNumber: document.getElementById('invoice-customer-number').value,
                email: document.getElementById('invoice-customer-email').value,
                phone: document.getElementById('invoice-customer-phone').value,
                address: document.getElementById('invoice-customer-address').value
            };

            await InvoiceModal.generateInvoice(customerData);
        });
    }
});

// Exportar para uso global
window.InvoiceModal = InvoiceModal;
