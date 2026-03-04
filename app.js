// Configuración de la API
const API_URL = 'https://coaches-alerts-emily-considering.trycloudflare.com/api'; // Cambiar por tu VPS en producción
const APP_TIMEZONE = 'America/Bogota';

// Estado global de la aplicación
const AppState = {
	menuItems: [],
	tables: [],
	orders: [],
	transactions: [],
	waiters: [],
	config: {},
	cashClosures: [],
	customers: [],
	invoices: [],
	dianConfig: null,
	isOnline: navigator.onLine
};

// Utilidades para LocalStorage
const Storage = {
	get(key) {
		const data = localStorage.getItem(key);
		return data ? JSON.parse(data) : null;
	},
	set(key, value) {
		localStorage.setItem(key, JSON.stringify(value));
	},
	remove(key) {
		localStorage.removeItem(key);
	}
};

// Cliente API - Solo backend, sin localStorage
const API = {
	async getAll(table) {
		try {
			const response = await fetch(`${API_URL}/${table}`, {
				timeout: 10000 // 10 segundos timeout
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = await response.json();
			return data;
		} catch (error) {
			console.error(`Error obteniendo ${table}:`, error);
			// No mostrar notificación aquí, se maneja en el código llamante
			throw error;
		}
	},

	async save(table, items, retries = 2) {
		for (let i = 0; i <= retries; i++) {
			try {
				const response = await fetch(`${API_URL}/${table}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(items)
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return await response.json();
			} catch (error) {
				if (i === retries) {
					console.error(`Error guardando ${table} después de ${retries + 1} intentos:`, error);
					throw error;
				}
				// Esperar antes de reintentar (500ms, 1000ms)
				await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
			}
		}
	},

	async update(table, id, item) {
		try {
			const response = await fetch(`${API_URL}/${table}/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(item)
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return await response.json();
		} catch (error) {
			console.error(`Error actualizando ${table}/${id}:`, error);
			throw error;
		}
	},

	async delete(table, id) {
		try {
			const response = await fetch(`${API_URL}/${table}/${id}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return await response.json();
		} catch (error) {
			console.error(`Error eliminando ${table}/${id}:`, error);
			throw error;
		}
	}
};

// Utilidades generales
const Utils = {
	generateId() {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	},

	formatCurrency(amount) {
		return new Intl.NumberFormat('es-MX', {
			style: 'currency',
			currency: 'MXN'
		}).format(amount);
	},

	formatDate(date) {
		return new Intl.DateTimeFormat('es-MX', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(date));
	},

	getDateKey(date = new Date(), timeZone = APP_TIMEZONE) {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(date);
	},

	getMonthKey(date = new Date(), timeZone = APP_TIMEZONE) {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit'
		}).formatToParts(date);
		const year = parts.find(p => p.type === 'year')?.value || '0000';
		const month = parts.find(p => p.type === 'month')?.value || '01';
		return `${year}-${month}`;
	},

	getDateKeyFromISO(isoString, timeZone = APP_TIMEZONE) {
		if (!isoString) return '';
		return Utils.getDateKey(new Date(isoString), timeZone);
	},

	getMonthKeyFromISO(isoString, timeZone = APP_TIMEZONE) {
		if (!isoString) return '';
		return Utils.getMonthKey(new Date(isoString), timeZone);
	},

	formatDateKeyForChart(dateKey, timeZone = APP_TIMEZONE) {
		if (!dateKey) return '';
		const [year, month, day] = dateKey.split('-').map(Number);
		const anchor = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
		return new Intl.DateTimeFormat('es-MX', {
			timeZone,
			weekday: 'short',
			day: 'numeric'
		}).format(anchor);
	},

	showNotification(message, type = 'info') {
		console.log(`[${type.toUpperCase()}] ${message}`);
		// Solo mostrar alertas para errores críticos
		if (type === 'error') {
			alert(message);
		}
	}
};

// Registro del Service Worker
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js')
			.then(reg => console.log('✅ Service Worker registrado'))
			.catch(err => console.error('❌ Error en Service Worker:', err));
	});
}

// Detectar cambios en la conexión
window.addEventListener('online', () => {
	AppState.isOnline = true;
	console.log('✅ Conexión restaurada');
});

window.addEventListener('offline', () => {
	AppState.isOnline = false;
	console.warn('⚠️ Sin conexión al servidor');
});

// Cargar datos iniciales - Solo desde backend
async function loadInitialData() {
	try {
		AppState.menuItems = await API.getAll('menu_items');
		AppState.tables = await API.getAll('tables');
		AppState.orders = await API.getAll('orders');
		AppState.transactions = await API.getAll('transactions');
		AppState.waiters = await API.getAll('waiters');

		// Intentar cargar cash_closures, si falla, usar array vacío
		try {
			AppState.cashClosures = await API.getAll('cash_closures');
		} catch (err) {
			console.warn('⚠️ Tabla cash_closures no disponible en el servidor');
			AppState.cashClosures = [];
		}

		// Cargar datos de facturación
		try {
			AppState.customers = await API.getAll('customers');
		} catch (err) {
			console.warn('⚠️ Tabla customers no disponible');
			AppState.customers = [];
		}

		try {
			AppState.invoices = await API.getAll('invoices');
		} catch (err) {
			console.warn('⚠️ Tabla invoices no disponible');
			AppState.invoices = [];
		}

		try {
			AppState.dianConfig = await Invoicing.loadDianConfig();
		} catch (err) {
			console.warn('⚠️ Configuración DIAN no disponible');
			AppState.dianConfig = null;
		}

		const configArray = await API.getAll('config');
		AppState.config = configArray.length > 0 ? configArray[0] : {};
	} catch (error) {
		console.error('Error cargando datos iniciales:', error);
		throw error;
	}
}

// Inicializar datos de ejemplo si no existen
async function initializeDefaultData() {
	if (AppState.menuItems.length === 0) {
		AppState.menuItems = [
			{
				id: Utils.generateId(),
				name: 'Hamburguesa Clásica',
				description: 'Carne de res, lechuga, tomate, queso',
				cost: 21000,
				price: 30000,
				category: 'Hamburguesas',
				available: true
			},
			{
				id: Utils.generateId(),
				name: 'Pizza Margarita',
				description: 'Tomate, mozzarella, albahaca',
				cost: 0,
				price: 25000,
				category: 'Pizzas',
				available: true
			},
			{
				id: Utils.generateId(),
				name: 'Ensalada César',
				description: 'Lechuga romana, pollo, crutones, parmesano',
				cost: 0,
				price: 12000,
				category: 'Ensaladas',
				available: true
			}
		];
		await API.save('menu_items', AppState.menuItems);
	} else {
		// Migración: Añadir campo cost a productos existentes que no lo tengan
		let needsUpdate = false;
		AppState.menuItems.forEach(item => {
			if (item.cost === undefined) {
				item.cost = 0;
				needsUpdate = true;
			}
		});
		if (needsUpdate) {
			await API.save('menu_items', AppState.menuItems);
		}
	}

	if (AppState.tables.length === 0) {
		AppState.tables = [];
		for (let i = 1; i <= 10; i++) {
			AppState.tables.push({
				id: Utils.generateId(),
				number: i,
				capacity: 4,
				status: 'available', // available, occupied, reserved
				currentOrder: null
			});
		}
		await API.save('tables', AppState.tables);
	}

	if (AppState.waiters.length === 0) {
		AppState.waiters = [
			{
				id: Utils.generateId(),
				name: 'Juan Pérez',
				active: true
			},
			{
				id: Utils.generateId(),
				name: 'María García',
				active: true
			}
		];
		await API.save('waiters', AppState.waiters);
	}
}

// Cargar cierres de caja
async function loadCashClosures() {
	return await API.getAll('cash_closures');
}

// ==================== FUNCIONES DE FACTURACIÓN ====================

/**
 * Módulo de facturación electrónica
 */
const Invoicing = {
	/**
	 * Crear cliente
	 */
	async createCustomer(customerData) {
		const customer = {
			id: Utils.generateId(),
			name: customerData.name,
			identificationType: customerData.identificationType || 'CC', // CC, NIT, CE, Pasaporte
			identificationNumber: customerData.identificationNumber,
			email: customerData.email || '',
			phone: customerData.phone || '',
			address: customerData.address || '',
			createdAt: new Date().toISOString()
		};

		AppState.customers.push(customer);
		await API.save('customers', AppState.customers);
		return customer;
	},

	/**
	 * Buscar cliente por documento
	 */
	findCustomerByDocument(identificationNumber) {
		return AppState.customers.find(c => c.identificationNumber === identificationNumber);
	},

	/**
	 * Obtener o crear cliente
	 */
	async getOrCreateCustomer(customerData) {
		const existing = this.findCustomerByDocument(customerData.identificationNumber);
		if (existing) {
			return existing;
		}
		return await this.createCustomer(customerData);
	},

	/**
	 * Crear factura electrónica
	 */
	async createElectronicInvoice(order, customer) {
		try {
			// Verificar configuración de DIAN/Alegra
			if (!AppState.dianConfig || !AppState.dianConfig.active) {
				throw new Error('La facturación electrónica no está configurada');
			}

			if (!AppState.dianConfig.alegraUser || !AppState.dianConfig.alegraToken) {
				throw new Error('Credenciales de Alegra no configuradas');
			}

			// Asegurar que el cliente existe
			const finalCustomer = await this.getOrCreateCustomer(customer);

			// Validar que los items del pedido tengan configuración para Alegra
			const itemsWithoutAlegra = order.items.filter(item => !item.alegraItemId);
			if (itemsWithoutAlegra.length > 0) {
				console.warn('Items sin configurar en Alegra:', itemsWithoutAlegra);
				// Puedes lanzar error o continuar. Por ahora continuamos.
			}

			// Llamar al backend para crear la factura
			const response = await fetch(`${API_URL}/invoices/create-electronic`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					order,
					customer: finalCustomer,
					dianConfig: AppState.dianConfig
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Error creando factura');
			}

			const result = await response.json();

			// Agregar factura al estado
			AppState.invoices.push(result.invoice);

			// Actualizar el pedido con la factura
			const orderIndex = AppState.orders.findIndex(o => o.id === order.id);
			if (orderIndex !== -1) {
				AppState.orders[orderIndex].invoiceId = result.invoice.id;
				AppState.orders[orderIndex].invoiced = true;
				await API.save('orders', AppState.orders);
			}

			return result;

		} catch (error) {
			console.error('Error creando factura electrónica:', error);
			throw error;
		}
	},

	/**
	 * Anular factura electrónica
	 */
	async voidInvoice(invoiceId) {
		try {
			if (!AppState.dianConfig) {
				throw new Error('Configuración de DIAN no encontrada');
			}

			const response = await fetch(`${API_URL}/invoices/${invoiceId}/void`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					dianConfig: AppState.dianConfig
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Error anulando factura');
			}

			const result = await response.json();

			// Actualizar en el estado local
			const invoiceIndex = AppState.invoices.findIndex(inv => inv.id === invoiceId);
			if (invoiceIndex !== -1) {
				AppState.invoices[invoiceIndex] = result.invoice;
			}

			return result;

		} catch (error) {
			console.error('Error anulando factura:', error);
			throw error;
		}
	},

	/**
	 * Verificar conexión con Alegra
	 */
	async testAlegraConnection(user, token) {
		try {
			const response = await fetch(`${API_URL}/alegra/test-connection`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user, token })
			});

			const result = await response.json();
			return result;

		} catch (error) {
			console.error('Error verificando conexión:', error);
			return { success: false, connected: false, error: error.message };
		}
	},

	/**
	 * Guardar configuración de DIAN/Alegra
	 */
	async saveDianConfig(config) {
		const dianConfig = {
			id: 'main',
			active: config.active !== false,
			alegraUser: config.alegraUser,
			alegraToken: config.alegraToken,
			companyNIT: config.companyNIT || '',
			companyName: config.companyName || '',
			termsConditions: config.termsConditions || 'Gracias por su compra',
			updatedAt: new Date().toISOString()
		};

		await API.update('dian_config', 'main', dianConfig);
		AppState.dianConfig = dianConfig;
		return dianConfig;
	},

	/**
	 * Cargar configuración de DIAN
	 */
	async loadDianConfig() {
		try {
			const response = await fetch(`${API_URL}/dian-config/active`);
			const config = await response.json();
			AppState.dianConfig = config;
			return config;
		} catch (error) {
			console.error('Error cargando configuración DIAN:', error);
			return null;
		}
	},

	/**
	 * Obtener impuestos de Alegra
	 */
	async getAlegraTaxes(user, token) {
		try {
			const response = await fetch(`${API_URL}/alegra/taxes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user, token })
			});

			const result = await response.json();
			return result.taxes || [];

		} catch (error) {
			console.error('Error obteniendo impuestos:', error);
			return [];
		}
	}
};

// Exportar para uso global
window.AppState = AppState;
window.API = API;
window.Utils = Utils;
window.Storage = Storage;
window.loadInitialData = loadInitialData;
window.initializeDefaultData = initializeDefaultData;
window.loadCashClosures = loadCashClosures;
window.Invoicing = Invoicing;
window.APP_TIMEZONE = APP_TIMEZONE;
