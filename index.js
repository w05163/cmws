/**
 * 适应服务器的websocket
 */
const { sendTypes, receiveType } = require('./config');

// 一个合法消息的示例
const message = {
	type: '', // 消息类型,决定了将调用服务的何种方法
	service: '', // 服务名称，决定了数据将传给那个服务
	data: {}, // 传递的数据
	id: ''// 客户端的唯一识别id
};

class ws extends WebSocket {
	constructor(url, protocols) {
		super(url, protocols);
		this.services = [];
		this._msgId = 0;
		this._funs = {};
		this._eventHandler = {};
		this.addEventListener('message', this.handleMessage);
	}

	handleMessage(e) {
		const { data } = e;
		if (typeof data === 'string') {
			let message = null;
			try {
				message = JSON.parse(data);
			} catch (error) {
				throw new Error('非法的数据类型');
			}
			if (message.id) {
				const id = message.id;
				const funObj = this._funs[id];
				if (funObj) {
					const { timeId, res } = funObj;
					delete this._funs[id];
					clearTimeout(timeId);
					res(message.data);
				}
			}
			if (message.type !== receiveType.response) {
				this.emit(message.service, message.data);
			}
		} else {
			// 二进制数据
		}
	}

	request(service, data, opt) {
		return this.sendRequest({
			service,
			type: sendTypes.request,
			data
		}, opt);
	}

	sendMsg(service, data) {
		this.sendJson({
			service,
			type: sendTypes.msg,
			data
		});
	}

	register(service, data) {
		if (this.services.includes(service)) {
			return new Promise((res, ret)=>res({ success: true }));
		}
		return this.sendRequest({
			service,
			type: sendTypes.register,
			data
		}).then(res=>{
			if (res.success) {
				this.services.push(service);
			}
			return res;
		});
	}

	cancel(service) {
		if (!this.services.includes(service)) return 0;
		return this.sendJson({
			service,
			type: sendTypes.cancel
		});
	}

	sendJson(obj) {
		const json = { ...obj };
		json.id = this._msgId++;
		this.send(JSON.stringify(json));
		return json.id;
	}

	sendRequest(data, opt = {}) {
		return new Promise((res, ret)=>{
			const id = this.sendJson(data);
			const timeId = setTimeout(()=>{
				delete this._funs[id];
				ret(new Error('响应超时'));
			}, opt.timeout || 20000);
			this._funs[id] = { res, timeId };
		});
	}

	emit(event, ...data) {
		const handlers = this._eventHandler[event];
		if (!handlers) return;
		handlers.forEach(h=>h.call(this, ...data));
	}

	on(event, handler) {
		this._eventHandler[event] = this._eventHandler[event] || [];
		this._eventHandler[event].push(handler);
	}

	off(event, handler) {
		const handlers = this._eventHandler[event];
		if (!handlers) return;
		this._eventHandler[event] = handlers.filter(h=>h !== handler);
	}
}

module.exports = ws;
