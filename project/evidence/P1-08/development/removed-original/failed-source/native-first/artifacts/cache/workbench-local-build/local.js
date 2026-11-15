//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/core.js
var _a$1;
function $constructor(name, initializer, params) {
	function init(inst, def) {
		if (!inst._zod) Object.defineProperty(inst, "_zod", {
			value: {
				def,
				constr: _,
				traits: /* @__PURE__ */ new Set()
			},
			enumerable: false
		});
		if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		const proto = _.prototype;
		const keys = Object.keys(proto);
		for (let i = 0; i < keys.length; i++) {
			const k = keys[i];
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		var _a;
		const inst = params?.Parent ? new Definition() : this;
		init(inst, def);
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		for (const fn of inst._zod.deferred) fn();
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
const globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
function cached(getter) {
	return { get value() {
		{
			const value = getter();
			Object.defineProperty(this, "value", { value });
			return value;
		}
		throw new Error("cached value already set");
	} };
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
	const ratio = val / step;
	const roundedRatio = Math.round(ratio);
	const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
	if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
	return ratio - roundedRatio;
}
const EVALUATING = /* @__PURE__*/ Symbol("evaluating");
function defineLazy(object, key, getter) {
	let value = void 0;
	Object.defineProperty(object, key, {
		get() {
			if (value === EVALUATING) return;
			if (value === void 0) {
				value = EVALUATING;
				value = getter();
			}
			return value;
		},
		set(v) {
			Object.defineProperty(object, key, { value: v });
		},
		configurable: true
	});
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) {
		const descriptors = Object.getOwnPropertyDescriptors(def);
		Object.assign(mergedDescriptors, descriptors);
	}
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = /* @__PURE__*/ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
const propertyKeyTypes = /* @__PURE__*/ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
	});
}
const NUMBER_FORMAT_RANGES = {
	safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const newShape = {};
			for (const key in mask) {
				if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				newShape[key] = currDef.shape[key];
			}
			assignProp(this, "shape", newShape);
			return newShape;
		},
		checks: []
	}));
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const newShape = { ...schema._zod.def.shape };
			for (const key in mask) {
				if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				delete newShape[key];
			}
			assignProp(this, "shape", newShape);
			return newShape;
		},
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = schema._zod.def.shape;
		for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const _shape = {
			...schema._zod.def.shape,
			...shape
		};
		assignProp(this, "shape", _shape);
		return _shape;
	} }));
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const _shape = {
			...schema._zod.def.shape,
			...shape
		};
		assignProp(this, "shape", _shape);
		return _shape;
	} }));
}
function merge(a, b) {
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	return clone(a, mergeDefs(a._zod.def, {
		get shape() {
			const _shape = {
				...a._zod.def.shape,
				...b._zod.def.shape
			};
			assignProp(this, "shape", _shape);
			return _shape;
		},
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask) {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const oldShape = schema._zod.def.shape;
			const shape = { ...oldShape };
			if (mask) for (const key in mask) {
				if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				shape[key] = Class ? new Class({
					type: "optional",
					innerType: oldShape[key]
				}) : oldShape[key];
			}
			else for (const key in oldShape) shape[key] = Class ? new Class({
				type: "optional",
				innerType: oldShape[key]
			}) : oldShape[key];
			assignProp(this, "shape", shape);
			return shape;
		},
		checks: []
	}));
}
function required(Class, schema, mask) {
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const oldShape = schema._zod.def.shape;
		const shape = { ...oldShape };
		if (mask) for (const key in mask) {
			if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
			if (!mask[key]) continue;
			shape[key] = new Class({
				type: "nonoptional",
				innerType: oldShape[key]
			});
		}
		else for (const key in oldShape) shape[key] = new Class({
			type: "nonoptional",
			innerType: oldShape[key]
		});
		assignProp(this, "shape", shape);
		return shape;
	} }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
	rest.path ?? (rest.path = []);
	rest.message = message;
	if (ctx?.reportInput) rest.input = _input;
	return rest;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/errors.js
const initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	Object.defineProperty(inst, "_zod", {
		value: inst._zod,
		enumerable: false
	});
	Object.defineProperty(inst, "issues", {
		value: def,
		enumerable: false
	});
	inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
	Object.defineProperty(inst, "toString", {
		value: () => inst.message,
		enumerable: false
	});
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) {
		fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
		fieldErrors[sub.path[0]].push(mapper(sub));
	} else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
					else {
						curr[el] = curr[el] || { _errors: [] };
						curr[el]._errors.push(mapper(issue));
					}
					curr = curr[el];
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/parse.js
const _parse = (_Err) => (schema, value, _ctx, _params) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	if (result.issues.length) {
		const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
		captureStackTrace(e, _params?.callee);
		throw e;
	}
	return result.value;
};
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	if (result.issues.length) {
		const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
		captureStackTrace(e, params?.callee);
		throw e;
	}
	return result.value;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? {
		success: false,
		error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	} : {
		success: true,
		data: result.value
	};
};
const safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? {
		success: false,
		error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	} : {
		success: true,
		data: result.value
	};
};
const safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _parse(_Err)(schema, value, ctx);
};
const _decode = (_Err) => (schema, value, _ctx) => {
	return _parse(_Err)(schema, value, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _parseAsync(_Err)(schema, value, ctx);
};
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _parseAsync(_Err)(schema, value, _ctx);
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const cuid = /^[cC][0-9a-z]{6,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
const uuid$1 = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
const httpProtocol = /^https?$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time$1(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime$1(args) {
	const time = timeSource({ precision: args.precision });
	const opts = ["Z"];
	if (args.local) opts.push("");
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const timeRegex = `${time}(?:${opts.join("|")})`;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string$1 = (params) => {
	const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
	return new RegExp(`^${regex}$`);
};
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const boolean$1 = /^(?:true|false)$/i;
const _null$2 = /^null$/i;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/checks.js
const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
const numericOriginMap = {
	number: "number",
	bigint: "bigint",
	object: "date"
};
const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
		if (def.value < curr) if (def.inclusive) bag.maximum = def.value;
		else bag.exclusiveMaximum = def.value;
	});
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
		if (def.value > curr) if (def.inclusive) bag.minimum = def.value;
		else bag.exclusiveMinimum = def.value;
	});
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.onattach.push((inst) => {
		var _a;
		(_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
	});
	inst._zod.check = (payload) => {
		if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
		if (typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
		payload.issues.push({
			origin: typeof payload.value,
			code: "not_multiple_of",
			divisor: def.value,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
	$ZodCheck.init(inst, def);
	def.format = def.format || "float64";
	const isInt = def.format?.includes("int");
	const origin = isInt ? "int" : "number";
	const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.format = def.format;
		bag.minimum = minimum;
		bag.maximum = maximum;
		if (isInt) bag.pattern = integer;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (isInt) {
			if (!Number.isInteger(input)) {
				payload.issues.push({
					expected: origin,
					format: def.format,
					code: "invalid_type",
					continue: false,
					input,
					inst
				});
				return;
			}
			if (!Number.isSafeInteger(input)) {
				if (input > 0) payload.issues.push({
					input,
					code: "too_big",
					maximum: Number.MAX_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				else payload.issues.push({
					input,
					code: "too_small",
					minimum: Number.MIN_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				return;
			}
		}
		if (input < minimum) payload.issues.push({
			origin: "number",
			input,
			code: "too_small",
			minimum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
		if (input > maximum) payload.issues.push({
			origin: "number",
			input,
			code: "too_big",
			maximum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
		if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (input.length <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
		if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (input.length >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.minimum = def.length;
		bag.maximum = def.length;
		bag.length = def.length;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		const length = input.length;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.format = def.format;
		if (def.pattern) {
			bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
			bag.patterns.add(def.pattern);
		}
	});
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex(def.includes);
	const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
	def.pattern = pattern;
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = []) {
		this.content = [];
		this.indent = 0;
		if (this) this.args = args;
	}
	indented(fn) {
		this.indent += 1;
		fn(this);
		this.indent -= 1;
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const args = this?.args;
		const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
		return new F(...args, lines.join("\n"));
	}
};
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/versions.js
const version = {
	major: 4,
	minor: 4,
	patch: 3
};
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/schemas.js
const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const checks = [...inst._zod.def.checks ?? []];
	if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
	defineLazy(inst, "~standard", () => ({
		validate: (value) => {
			try {
				const r = safeParse$1(inst, value);
				return r.success ? { value: r.data } : { issues: r.error?.issues };
			} catch (_) {
				return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
			}
		},
		vendor: "zod",
		version: 1
	}));
});
const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid$1(v));
	} else def.pattern ?? (def.pattern = uuid$1());
	$ZodStringFormat.init(inst, def);
});
const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			if (!def.normalize && def.protocol?.source === httpProtocol.source) {
				if (!/^https?:\/\//i.test(trimmed)) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid URL format",
						input: payload.value,
						inst,
						continue: !def.abort
					});
					return;
				}
			}
			const url = new URL(trimmed);
			if (def.hostname) {
				def.hostname.lastIndex = 0;
				if (!def.hostname.test(url.hostname)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid hostname",
					pattern: def.hostname.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
			if (def.protocol) {
				def.protocol.lastIndex = 0;
				if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid protocol",
					pattern: def.protocol.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
			if (def.normalize) payload.value = url.href;
			else payload.value = trimmed;
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
	def.pattern ?? (def.pattern = nanoid);
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime$1(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date$1);
	$ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time$1(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration$1);
	$ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.format = `ipv6`;
	inst._zod.check = (payload) => {
		try {
			new URL(`http://[${payload.value}]`);
		} catch {
			payload.issues.push({
				code: "invalid_format",
				format: "ipv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		const parts = payload.value.split("/");
		try {
			if (parts.length !== 2) throw new Error();
			const [address, prefix] = parts;
			if (!prefix) throw new Error();
			const prefixNum = Number(prefix);
			if (`${prefixNum}` !== prefix) throw new Error();
			if (prefixNum < 0 || prefixNum > 128) throw new Error();
			new URL(`http://[${address}]`);
		} catch {
			payload.issues.push({
				code: "invalid_format",
				format: "cidrv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.contentEncoding = "base64";
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64URL(data) {
	if (!base64url.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64url);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.contentEncoding = "base64url";
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Number(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
		const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
		payload.issues.push({
			expected: "number",
			code: "invalid_type",
			input,
			inst,
			...received ? { received } : {}
		});
		return payload;
	};
});
const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
	$ZodCheckNumberFormat.init(inst, def);
	$ZodNumber.init(inst, def);
});
const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = boolean$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Boolean(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "boolean") return payload;
		payload.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
const $ZodNull = /*@__PURE__*/ $constructor("$ZodNull", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = _null$2;
	inst._zod.values = /* @__PURE__ */ new Set([null]);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (input === null) return payload;
		payload.issues.push({
			expected: "null",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = Array(input.length);
		const proms = [];
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else handleArrayResult(result, payload, i);
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
	const isPresent = key in input;
	if (result.issues.length) {
		if (isOptionalIn && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && !isOptionalIn) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		keys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const isOptionalIn = _catchall.optin === "optional";
	const isOptionalOut = _catchall.optout === "optional";
	for (const key in input) {
		if (key === "__proto__") continue;
		if (keySet.has(key)) continue;
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
		else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
		const sh = def.shape;
		Object.defineProperty(def, "shape", { get: () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			return newSh;
		} });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazy(inst._zod, "propValues", () => {
		const shape = def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
			}
		}
		return propValues;
	});
	const isObject$2 = isObject;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = {};
		const proms = [];
		const shape = value.shape;
		for (const key of value.keys) {
			const el = shape[key];
			const isOptionalIn = el._zod.optin === "optional";
			const isOptionalOut = el._zod.optout === "optional";
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
			else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
	};
});
const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const generateFastpass = (shape) => {
		const doc = new Doc([
			"shape",
			"payload",
			"ctx"
		]);
		const normalized = _normalized.value;
		const parseStr = (key) => {
			const k = esc(key);
			return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		};
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.keys) ids[key] = `key_${counter++}`;
		doc.write(`const newResult = {};`);
		for (const key of normalized.keys) {
			const id = ids[key];
			const k = esc(key);
			const schema = shape[key];
			const isOptionalIn = schema?._zod?.optin === "optional";
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(key)};`);
			if (isOptionalIn && isOptionalOut) doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
			else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			else doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		const fn = doc.compile();
		return (payload, ctx) => fn(shape, payload, ctx);
	};
	let fastpass;
	const isObject$1 = isObject;
	const jit = !globalConfig.jitless;
	const fastEnabled = jit && allowsEval.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
	defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazy(inst._zod, "values", () => {
		if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazy(inst._zod, "pattern", () => {
		if (def.options.every((o) => o._zod.pattern)) {
			const patterns = def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
const $ZodDiscriminatedUnion = /*@__PURE__*/ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
	def.inclusive = false;
	$ZodUnion.init(inst, def);
	const _super = inst._zod.parse;
	defineLazy(inst._zod, "propValues", () => {
		const propValues = {};
		for (const option of def.options) {
			const pv = option._zod.propValues;
			if (!pv || Object.keys(pv).length === 0) throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
			for (const [k, v] of Object.entries(pv)) {
				if (!propValues[k]) propValues[k] = /* @__PURE__ */ new Set();
				for (const val of v) propValues[k].add(val);
			}
		}
		return propValues;
	});
	const disc = cached(() => {
		const opts = def.options;
		const map = /* @__PURE__ */ new Map();
		for (const o of opts) {
			const values = o._zod.propValues?.[def.discriminator];
			if (!values || values.size === 0) throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
			for (const v of values) {
				if (map.has(v)) throw new Error(`Duplicate discriminator value "${String(v)}"`);
				map.set(v, o);
			}
		}
		return map;
	});
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isObject(input)) {
			payload.issues.push({
				code: "invalid_type",
				expected: "object",
				input,
				inst
			});
			return payload;
		}
		const opt = disc.value.get(input?.[def.discriminator]);
		if (opt) return opt._zod.run(payload, ctx);
		if (def.unionFallback || ctx.direction === "backward") return _super(payload, ctx);
		payload.issues.push({
			code: "invalid_union",
			errors: [],
			note: "No matching discriminator",
			discriminator: def.discriminator,
			options: Array.from(disc.value.keys()),
			input,
			path: [def.discriminator],
			inst
		});
		return payload;
	};
});
const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		for (const key of sharedKeys) {
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
		unrecIssue ?? (unrecIssue = iss);
		for (const k of iss.keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k).l = true;
		}
	} else result.issues.push(iss);
	for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
		if (!unrecKeys.has(k)) unrecKeys.set(k, {});
		unrecKeys.get(k).r = true;
	}
	else result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length && unrecIssue) result.issues.push({
		...unrecIssue,
		keys: bothKeys
	});
	if (aborted(result)) return result;
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	result.value = merged.data;
	return result;
}
const $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isPlainObject(input)) {
			payload.issues.push({
				expected: "record",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		const proms = [];
		const values = def.keyType._zod.values;
		if (values) {
			payload.value = {};
			const recordKeys = /* @__PURE__ */ new Set();
			for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
				recordKeys.add(typeof key === "number" ? key.toString() : key);
				const keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (keyResult.issues.length) {
					payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			let unrecognized;
			for (const key in input) if (!recordKeys.has(key)) {
				unrecognized = unrecognized ?? [];
				unrecognized.push(key);
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized
			});
		} else {
			payload.value = {};
			for (const key of Reflect.ownKeys(input)) {
				if (key === "__proto__") continue;
				if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
				let keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (typeof key === "string" && number$1.test(key) && keyResult.issues.length) {
					const retryResult = def.keyType._zod.run({
						value: Number(key),
						issues: []
					}, ctx);
					if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (retryResult.issues.length === 0) keyResult = retryResult;
				}
				if (keyResult.issues.length) {
					if (def.mode === "loose") payload.value[key] = input[key];
					else payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[keyResult.value] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[keyResult.value] = result.value;
				}
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
	$ZodType.init(inst, def);
	if (def.values.length === 0) throw new Error("Cannot create literal schema with no valid values");
	const values = new Set(def.values);
	inst._zod.values = values;
	inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (values.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values: def.values,
			input,
			inst
		});
		return payload;
	};
});
const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			payload.fallback = true;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		payload.fallback = true;
		return payload;
	};
});
function handleOptionalResult(result, input) {
	if (input === void 0 && (result.issues.length || result.fallback)) return {
		issues: [],
		value: void 0
	};
	return result;
}
const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	inst._zod.optout = "optional";
	defineLazy(inst._zod, "values", () => {
		return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
	});
	defineLazy(inst._zod, "pattern", () => {
		const pattern = def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (def.innerType._zod.optin === "optional") {
			const input = payload.value;
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, input));
			return handleOptionalResult(result, input);
		}
		if (payload.value === void 0) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
	defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
	defineLazy(inst._zod, "pattern", () => {
		const pattern = def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazy(inst._zod, "values", () => {
		return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "values", () => {
		const v = def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => {
			payload.value = result.value;
			if (result.issues.length) {
				payload.value = def.catchValue({
					...payload,
					error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
					input: payload.value
				});
				payload.issues = [];
				payload.fallback = true;
			}
			return payload;
		});
		payload.value = result.value;
		if (result.issues.length) {
			payload.value = def.catchValue({
				...payload,
				error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
				input: payload.value
			});
			payload.issues = [];
			payload.fallback = true;
		}
		return payload;
	};
});
const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "values", () => def.in._zod.values);
	defineLazy(inst._zod, "optin", () => def.in._zod.optin);
	defineLazy(inst._zod, "optout", () => def.out._zod.optout);
	defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.length) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues,
		fallback: left.fallback
	}, ctx);
}
const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
	defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	payload.value = Object.freeze(payload.value);
	return payload;
}
const $ZodLazy = /*@__PURE__*/ $constructor("$ZodLazy", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "innerType", () => {
		const d = def;
		if (!d._cachedInner) d._cachedInner = def.getter();
		return d._cachedInner;
	});
	defineLazy(inst._zod, "pattern", () => inst._zod.innerType?._zod?.pattern);
	defineLazy(inst._zod, "propValues", () => inst._zod.innerType?._zod?.propValues);
	defineLazy(inst._zod, "optin", () => inst._zod.innerType?._zod?.optin ?? void 0);
	defineLazy(inst._zod, "optout", () => inst._zod.innerType?._zod?.optout ?? void 0);
	inst._zod.parse = (payload, ctx) => {
		return inst._zod.innerType._zod.run(payload, ctx);
	};
});
const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/api.js
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
	return new Class({
		type: "string",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
	return new Class({
		type: "number",
		checks: [],
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
	return new Class({
		type: "number",
		check: "number_format",
		abort: false,
		format: "safeint",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
	return new Class({
		type: "boolean",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _null$1(Class, params) {
	return new Class({
		type: "null",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
	return new $ZodCheckMultipleOf({
		check: "multiple_of",
		...normalizeParams(params),
		value
	});
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _custom(Class, fn, _params) {
	const norm = normalizeParams(_params);
	norm.abort ?? (norm.abort = true);
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...norm
	});
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				_issue.input ?? (_issue.input = payload.value);
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/to-json-schema.js
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		external: params?.external ?? void 0
	};
}
function process(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			process(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) Object.assign(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
			};
		}
		if (entry[1] === root) return { ref: "#" };
		const defUriPrefix = `#/${defsSegment}/`;
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + defId
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") {
				extractToDef(entry);
				continue;
			}
		}
	}
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else Object.assign(schema, refSchema);
			Object.assign(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	Object.assign(result, root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			defs[seen.defId] = seen.def;
		}
	}
	if (ctx.external) {} else if (Object.keys(defs).length > 0) if (ctx.target === "draft-2020-12") result.$defs = defs;
	else result.definitions = defs;
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	process(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	process(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/json-schema-processors.js
const formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
const stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time") delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const regexes = [...patterns];
		if (regexes.length === 1) json.pattern = regexes[0].source;
		else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
const numberProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
	if (typeof format === "string" && format.includes("int")) json.type = "integer";
	else json.type = "number";
	const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
	const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
	const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
	if (exMin) if (legacy) {
		json.minimum = exclusiveMinimum;
		json.exclusiveMinimum = true;
	} else json.exclusiveMinimum = exclusiveMinimum;
	else if (typeof minimum === "number") json.minimum = minimum;
	if (exMax) if (legacy) {
		json.maximum = exclusiveMaximum;
		json.exclusiveMaximum = true;
	} else json.exclusiveMaximum = exclusiveMaximum;
	else if (typeof maximum === "number") json.maximum = maximum;
	if (typeof multipleOf === "number") json.multipleOf = multipleOf;
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
	json.type = "boolean";
};
const nullProcessor = (_schema, ctx, json, _params) => {
	if (ctx.target === "openapi-3.0") {
		json.type = "string";
		json.nullable = true;
		json.enum = [null];
	} else json.type = "null";
};
const neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
const enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
const literalProcessor = (schema, ctx, json, _params) => {
	const def = schema._zod.def;
	const vals = [];
	for (const val of def.values) if (val === void 0) {
		if (ctx.unrepresentable === "throw") throw new Error("Literal `undefined` cannot be represented in JSON Schema");
	} else if (typeof val === "bigint") if (ctx.unrepresentable === "throw") throw new Error("BigInt literals cannot be represented in JSON Schema");
	else vals.push(Number(val));
	else vals.push(val);
	if (vals.length === 0) {} else if (vals.length === 1) {
		const val = vals[0];
		json.type = val === null ? "null" : typeof val;
		if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
		else json.const = val;
	} else {
		if (vals.every((v) => typeof v === "number")) json.type = "number";
		if (vals.every((v) => typeof v === "string")) json.type = "string";
		if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
		if (vals.every((v) => v === null)) json.type = "null";
		json.enum = vals;
	}
};
const customProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
};
const transformProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
};
const arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = schema._zod.bag;
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = process(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
const objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	json.properties = {};
	const shape = def.shape;
	for (const key in shape) json.properties[key] = process(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	});
	const allKeys = new Set(Object.keys(shape));
	const requiredKeys = new Set([...allKeys].filter((key) => {
		const v = def.shape[key]._zod;
		if (ctx.io === "input") return v.optin === void 0;
		else return v.optout === void 0;
	}));
	if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = process(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
const unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => process(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
const intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = process(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = process(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
};
const recordProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	const keyType = def.keyType;
	const patterns = keyType._zod.bag?.patterns;
	if (def.mode === "loose" && patterns && patterns.size > 0) {
		const valueSchema = process(def.valueType, ctx, {
			...params,
			path: [
				...params.path,
				"patternProperties",
				"*"
			]
		});
		json.patternProperties = {};
		for (const pattern of patterns) json.patternProperties[pattern.source] = valueSchema;
	} else {
		if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") json.propertyNames = process(def.keyType, ctx, {
			...params,
			path: [...params.path, "propertyNames"]
		});
		json.additionalProperties = process(def.valueType, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	}
	const keyValues = keyType._zod.values;
	if (keyValues) {
		const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
		if (validKeyValues.length > 0) json.required = validKeyValues;
	}
};
const nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		throw new Error("Dynamic catch values are not supported in JSON Schema");
	}
	json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	process(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
const lazyProcessor = (schema, ctx, _json, params) => {
	const innerType = schema._zod.innerType;
	process(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/classic/iso.js
const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function datetime(params) {
	return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function date(params) {
	return /* @__PURE__ */ _isoDate(ZodISODate, params);
}
const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function time(params) {
	return /* @__PURE__ */ _isoTime(ZodISOTime, params);
}
const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function duration(params) {
	return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
}
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/classic/errors.js
const initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	Object.defineProperties(inst, {
		format: { value: (mapper) => formatError(inst, mapper) },
		flatten: { value: (mapper) => flattenError(inst, mapper) },
		addIssue: { value: (issue) => {
			inst.issues.push(issue);
			inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
		} },
		addIssues: { value: (issues) => {
			inst.issues.push(...issues);
			inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
		} },
		isEmpty: { get() {
			return inst.issues.length === 0;
		} }
	});
};
const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, { Parent: Error });
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/classic/parse.js
const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
//#endregion
//#region node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/classic/schemas.js
const _installedGroups = /* @__PURE__ */ new WeakMap();
function _installLazyMethods(inst, group, methods) {
	const proto = Object.getPrototypeOf(inst);
	let installed = _installedGroups.get(proto);
	if (!installed) {
		installed = /* @__PURE__ */ new Set();
		_installedGroups.set(proto, installed);
	}
	if (installed.has(group)) return;
	installed.add(group);
	for (const key in methods) {
		const fn = methods[key];
		Object.defineProperty(proto, key, {
			configurable: true,
			enumerable: false,
			get() {
				const bound = fn.bind(this);
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable: true,
					value: bound
				});
				return bound;
			},
			set(v) {
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable: true,
					value: v
				});
			}
		});
	}
}
const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
	$ZodType.init(inst, def);
	Object.assign(inst["~standard"], { jsonSchema: {
		input: createStandardJSONSchemaMethod(inst, "input"),
		output: createStandardJSONSchemaMethod(inst, "output")
	} });
	inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
	inst.def = def;
	inst.type = def.type;
	Object.defineProperty(inst, "_def", { value: def });
	inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
	inst.safeParse = (data, params) => safeParse(inst, data, params);
	inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
	inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
	inst.spa = inst.safeParseAsync;
	inst.encode = (data, params) => encode(inst, data, params);
	inst.decode = (data, params) => decode(inst, data, params);
	inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
	inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
	inst.safeEncode = (data, params) => safeEncode(inst, data, params);
	inst.safeDecode = (data, params) => safeDecode(inst, data, params);
	inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
	inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
	_installLazyMethods(inst, "ZodType", {
		check(...chks) {
			const def = this.def;
			return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
				check: ch,
				def: { check: "custom" },
				onattach: []
			} } : ch)] }), { parent: true });
		},
		with(...chks) {
			return this.check(...chks);
		},
		clone(def, params) {
			return clone(this, def, params);
		},
		brand() {
			return this;
		},
		register(reg, meta) {
			reg.add(this, meta);
			return this;
		},
		refine(check, params) {
			return this.check(refine(check, params));
		},
		superRefine(refinement, params) {
			return this.check(superRefine(refinement, params));
		},
		overwrite(fn) {
			return this.check(/* @__PURE__ */ _overwrite(fn));
		},
		optional() {
			return optional(this);
		},
		exactOptional() {
			return exactOptional(this);
		},
		nullable() {
			return nullable(this);
		},
		nullish() {
			return optional(nullable(this));
		},
		nonoptional(params) {
			return nonoptional(this, params);
		},
		array() {
			return array(this);
		},
		or(arg) {
			return union([this, arg]);
		},
		and(arg) {
			return intersection(this, arg);
		},
		transform(tx) {
			return pipe(this, transform(tx));
		},
		default(d) {
			return _default(this, d);
		},
		prefault(d) {
			return prefault(this, d);
		},
		catch(params) {
			return _catch(this, params);
		},
		pipe(target) {
			return pipe(this, target);
		},
		readonly() {
			return readonly(this);
		},
		describe(description) {
			const cl = this.clone();
			globalRegistry.add(cl, { description });
			return cl;
		},
		meta(...args) {
			if (args.length === 0) return globalRegistry.get(this);
			const cl = this.clone();
			globalRegistry.add(cl, args[0]);
			return cl;
		},
		isOptional() {
			return this.safeParse(void 0).success;
		},
		isNullable() {
			return this.safeParse(null).success;
		},
		apply(fn) {
			return fn(this);
		}
	});
	Object.defineProperty(inst, "description", {
		get() {
			return globalRegistry.get(inst)?.description;
		},
		configurable: true
	});
	return inst;
});
/** @internal */
const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
	const bag = inst._zod.bag;
	inst.format = bag.format ?? null;
	inst.minLength = bag.minimum ?? null;
	inst.maxLength = bag.maximum ?? null;
	_installLazyMethods(inst, "_ZodString", {
		regex(...args) {
			return this.check(/* @__PURE__ */ _regex(...args));
		},
		includes(...args) {
			return this.check(/* @__PURE__ */ _includes(...args));
		},
		startsWith(...args) {
			return this.check(/* @__PURE__ */ _startsWith(...args));
		},
		endsWith(...args) {
			return this.check(/* @__PURE__ */ _endsWith(...args));
		},
		min(...args) {
			return this.check(/* @__PURE__ */ _minLength(...args));
		},
		max(...args) {
			return this.check(/* @__PURE__ */ _maxLength(...args));
		},
		length(...args) {
			return this.check(/* @__PURE__ */ _length(...args));
		},
		nonempty(...args) {
			return this.check(/* @__PURE__ */ _minLength(1, ...args));
		},
		lowercase(params) {
			return this.check(/* @__PURE__ */ _lowercase(params));
		},
		uppercase(params) {
			return this.check(/* @__PURE__ */ _uppercase(params));
		},
		trim() {
			return this.check(/* @__PURE__ */ _trim());
		},
		normalize(...args) {
			return this.check(/* @__PURE__ */ _normalize(...args));
		},
		toLowerCase() {
			return this.check(/* @__PURE__ */ _toLowerCase());
		},
		toUpperCase() {
			return this.check(/* @__PURE__ */ _toUpperCase());
		},
		slugify() {
			return this.check(/* @__PURE__ */ _slugify());
		}
	});
});
const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
	inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
	inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
	inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
	inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
	inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
	inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
	inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
	inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
	inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
	inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
	inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
	inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
	inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
	inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
	inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
	inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
	inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
	inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
	inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
	inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
	inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
	inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
	inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
	inst.datetime = (params) => inst.check(datetime(params));
	inst.date = (params) => inst.check(date(params));
	inst.time = (params) => inst.check(time(params));
	inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
	return /* @__PURE__ */ _string(ZodString, params);
}
const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function uuid(params) {
	return /* @__PURE__ */ _uuid(ZodUUID, params);
}
const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function url(params) {
	return /* @__PURE__ */ _url(ZodURL, params);
}
const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
	$ZodNumber.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
	_installLazyMethods(inst, "ZodNumber", {
		gt(value, params) {
			return this.check(/* @__PURE__ */ _gt(value, params));
		},
		gte(value, params) {
			return this.check(/* @__PURE__ */ _gte(value, params));
		},
		min(value, params) {
			return this.check(/* @__PURE__ */ _gte(value, params));
		},
		lt(value, params) {
			return this.check(/* @__PURE__ */ _lt(value, params));
		},
		lte(value, params) {
			return this.check(/* @__PURE__ */ _lte(value, params));
		},
		max(value, params) {
			return this.check(/* @__PURE__ */ _lte(value, params));
		},
		int(params) {
			return this.check(int(params));
		},
		safe(params) {
			return this.check(int(params));
		},
		positive(params) {
			return this.check(/* @__PURE__ */ _gt(0, params));
		},
		nonnegative(params) {
			return this.check(/* @__PURE__ */ _gte(0, params));
		},
		negative(params) {
			return this.check(/* @__PURE__ */ _lt(0, params));
		},
		nonpositive(params) {
			return this.check(/* @__PURE__ */ _lte(0, params));
		},
		multipleOf(value, params) {
			return this.check(/* @__PURE__ */ _multipleOf(value, params));
		},
		step(value, params) {
			return this.check(/* @__PURE__ */ _multipleOf(value, params));
		},
		finite() {
			return this;
		}
	});
	const bag = inst._zod.bag;
	inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
	inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
	inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? .5);
	inst.isFinite = true;
	inst.format = bag.format ?? null;
});
function number(params) {
	return /* @__PURE__ */ _number(ZodNumber, params);
}
const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
	$ZodNumberFormat.init(inst, def);
	ZodNumber.init(inst, def);
});
function int(params) {
	return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
	$ZodBoolean.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
	return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
const ZodNull = /*@__PURE__*/ $constructor("ZodNull", (inst, def) => {
	$ZodNull.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullProcessor(inst, ctx, json, params);
});
function _null(params) {
	return /* @__PURE__ */ _null$1(ZodNull, params);
}
const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => void 0;
});
function unknown() {
	return /* @__PURE__ */ _unknown(ZodUnknown);
}
const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return /* @__PURE__ */ _never(ZodNever, params);
}
const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
	_installLazyMethods(inst, "ZodArray", {
		min(n, params) {
			return this.check(/* @__PURE__ */ _minLength(n, params));
		},
		nonempty(params) {
			return this.check(/* @__PURE__ */ _minLength(1, params));
		},
		max(n, params) {
			return this.check(/* @__PURE__ */ _maxLength(n, params));
		},
		length(n, params) {
			return this.check(/* @__PURE__ */ _length(n, params));
		},
		unwrap() {
			return this.element;
		}
	});
});
function array(element, params) {
	return /* @__PURE__ */ _array(ZodArray, element, params);
}
const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	defineLazy(inst, "shape", () => {
		return def.shape;
	});
	_installLazyMethods(inst, "ZodObject", {
		keyof() {
			return _enum(Object.keys(this._zod.def.shape));
		},
		catchall(catchall) {
			return this.clone({
				...this._zod.def,
				catchall
			});
		},
		passthrough() {
			return this.clone({
				...this._zod.def,
				catchall: unknown()
			});
		},
		loose() {
			return this.clone({
				...this._zod.def,
				catchall: unknown()
			});
		},
		strict() {
			return this.clone({
				...this._zod.def,
				catchall: never()
			});
		},
		strip() {
			return this.clone({
				...this._zod.def,
				catchall: void 0
			});
		},
		extend(incoming) {
			return extend(this, incoming);
		},
		safeExtend(incoming) {
			return safeExtend(this, incoming);
		},
		merge(other) {
			return merge(this, other);
		},
		pick(mask) {
			return pick(this, mask);
		},
		omit(mask) {
			return omit(this, mask);
		},
		partial(...args) {
			return partial(ZodOptional, this, args[0]);
		},
		required(...args) {
			return required(ZodNonOptional, this, args[0]);
		}
	});
});
function object(shape, params) {
	const def = {
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	};
	return new ZodObject(def);
}
function strictObject(shape, params) {
	return new ZodObject({
		type: "object",
		shape,
		catchall: never(),
		...normalizeParams(params)
	});
}
const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
const ZodDiscriminatedUnion = /*@__PURE__*/ $constructor("ZodDiscriminatedUnion", (inst, def) => {
	ZodUnion.init(inst, def);
	$ZodDiscriminatedUnion.init(inst, def);
});
function discriminatedUnion(discriminator, options, params) {
	return new ZodDiscriminatedUnion({
		type: "union",
		options,
		discriminator,
		...normalizeParams(params)
	});
}
const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
const ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
	$ZodRecord.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
	inst.keyType = def.keyType;
	inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
	if (!valueType || !valueType._zod) return new ZodRecord({
		type: "record",
		keyType: string(),
		valueType: keyType,
		...normalizeParams(valueType)
	});
	return new ZodRecord({
		type: "record",
		keyType,
		valueType,
		...normalizeParams(params)
	});
}
const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = Object.values(def.entries);
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
	return new ZodEnum({
		type: "enum",
		entries,
		...normalizeParams(params)
	});
}
const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
	$ZodLiteral.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
	inst.values = new Set(def.values);
	Object.defineProperty(inst, "value", { get() {
		if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
		return def.values[0];
	} });
});
function literal(value, params) {
	return new ZodLiteral({
		type: "literal",
		values: Array.isArray(value) ? value : [value],
		...normalizeParams(params)
	});
}
const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				_issue.input ?? (_issue.input = payload.value);
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			payload.fallback = true;
			return payload;
		});
		payload.value = output;
		payload.fallback = true;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
	});
}
const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
const ZodLazy = /*@__PURE__*/ $constructor("ZodLazy", (inst, def) => {
	$ZodLazy.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => lazyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.getter();
});
function lazy(getter) {
	return new ZodLazy({
		type: "lazy",
		getter
	});
}
const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function custom(fn, _params) {
	return /* @__PURE__ */ _custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
	return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return /* @__PURE__ */ _superRefine(fn, params);
}
function json(params) {
	const jsonSchema = lazy(() => {
		return union([
			string(params),
			number(),
			boolean(),
			_null(),
			array(jsonSchema),
			record(string(), jsonSchema)
		]);
	});
	return jsonSchema;
}
//#endregion
//#region packages/contracts/src/primitives.ts
const id = (prefix) => string().regex(new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`)).brand();
const ids = {
	project: id("prj"),
	userTask: id("task"),
	run: id("run"),
	work: id("work"),
	attempt: id("attempt"),
	invocation: id("invocation"),
	invocationAttempt: id("iattempt"),
	activation: id("activation"),
	grant: id("grant"),
	operation: id("op"),
	event: id("evt"),
	request: id("req"),
	artifact: id("artifact"),
	manifest: id("manifest"),
	roleSnapshot: id("role"),
	definitionSnapshot: id("definition"),
	candidate: id("candidate"),
	release: id("release"),
	question: id("question"),
	requirement: id("requirement"),
	session: id("session"),
	job: id("job"),
	attachment: id("attachment"),
	message: id("message"),
	change: id("change"),
	decision: id("decision"),
	preview: id("preview"),
	dataset: id("dataset"),
	export: id("export"),
	analysis: id("analysis"),
	check: id("check")
};
const revision = number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const epoch = number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const sha256 = string().regex(/^[a-f0-9]{64}$/);
const gitCommit = string().regex(/^[a-f0-9]{40}$/);
const timestamp = datetime({ precision: 3 });
const role = _enum([
	"product",
	"architect",
	"developer",
	"tester"
]);
const opaqueKey = string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const protocolTaskId = string().min(1).max(512);
const nonemptyText = string().min(1).max(2e4);
const inputText = string().regex(/^[\s\S]{1,20000}$/u);
const projectName = string().regex(/^[\s\S]{1,80}$/u);
const taskTitle = string().regex(/^[\s\S]{1,120}$/u);
const artifactRef = strictObject({
	artifactId: ids.artifact,
	sha256
});
const runState = strictObject({
	phase: _enum([
		"PREPARING",
		"UNDERSTANDING",
		"PLANNING",
		"EXECUTING",
		"VERIFYING",
		"REVIEW"
	]),
	controlGate: _enum([
		"OPEN",
		"PAUSING",
		"PAUSED",
		"CANCELLING"
	]),
	terminalOutcome: _enum([
		"COMPLETED",
		"FAILED",
		"CANCELLED"
	]).nullable()
});
const attemptState = _enum([
	"RESERVED",
	"SUBMITTED",
	"WORKING",
	"INPUT_REQUIRED",
	"VERIFYING",
	"OUTCOME_UNKNOWN",
	"STOPPING",
	"SUCCEEDED",
	"FAILED",
	"INTERRUPTED",
	"CANCELLED"
]);
_enum([
	"QUEUED",
	"RUNNING",
	"INPUT_REQUIRED",
	"VERIFYING",
	"STOPPING",
	"OUTCOME_UNKNOWN",
	"SUCCEEDED",
	"FAILED",
	"CANCELLED"
]);
const operationStatus = _enum([
	"ACCEPTED",
	"RUNNING",
	"WAITING",
	"SUCCEEDED",
	"FAILED",
	"OUTCOME_UNKNOWN"
]);
_enum([
	"QUEUED",
	"STARTING",
	"RUNNING",
	"STOPPING",
	"EXITED",
	"OUTCOME_UNKNOWN"
]);
const a2aTaskState = _enum([
	"submitted",
	"working",
	"input-required",
	"auth-required",
	"completed",
	"failed",
	"canceled",
	"rejected"
]);
strictObject({ error: strictObject({
	code: _enum([
		"SCHEMA_INVALID",
		"PRECONDITION_REQUIRED",
		"PRECONDITION_FAILED",
		"BASIS_SUPERSEDED",
		"PLAN_SUPERSEDED",
		"PERMIT_REVOKED",
		"PERMIT_EXPIRED",
		"PERMIT_SCOPE_DENIED",
		"IDEMPOTENCY_KEY_REUSED",
		"AUTHENTICATION_REQUIRED",
		"FORBIDDEN",
		"RESOURCE_NOT_FOUND",
		"ACTIVE_RUN_EXISTS",
		"LIMIT_EXCEEDED",
		"OUTCOME_UNKNOWN",
		"SERVICE_UNAVAILABLE",
		"PLAN_INVALID",
		"PLAN_ALREADY_CONFIRMED",
		"RUN_TERMINAL",
		"ADMISSION_CLOSED",
		"PREVIEW_ACCESS_NOT_CONFIGURED",
		"PREVIEW_UNAVAILABLE",
		"RELEASE_ACCESS_NOT_CONFIGURED",
		"RELEASE_UNAVAILABLE",
		"RANGE_NOT_SUPPORTED",
		"EXPORT_UNAVAILABLE",
		"ACCEPTANCE_UNAVAILABLE",
		"REVIEW_UNAVAILABLE",
		"CONTENT_CORRUPT",
		"CONTENT_TOO_LARGE",
		"IDENTITY_NOT_CONFIGURED",
		"REQUEST_ORIGIN_INVALID",
		"REQUEST_HEADERS_INVALID",
		"REQUEST_HOST_INVALID",
		"COOKIE_AUTH_NOT_CONFIGURED",
		"SERVICE_STOPPING",
		"CONTENT_TYPE_INVALID",
		"REQUEST_TOO_LARGE",
		"JSON_INVALID",
		"UPLOAD_CAPACITY",
		"UPLOAD_IN_PROGRESS",
		"UPLOAD_FAILED",
		"UPLOAD_TIMEOUT",
		"UPLOAD_INTERRUPTED",
		"UPLOAD_TOO_LARGE",
		"UPLOAD_INVALID",
		"UPLOAD_RESULT_INVALID",
		"MULTIPART_INVALID",
		"ATTACHMENT_TYPE_INVALID",
		"ATTACHMENT_ENCODING_INVALID",
		"ATTACHMENT_EMPTY",
		"ATTACHMENT_BOUND",
		"UPLOAD_CONTENT_CONFLICT",
		"UPLOAD_HASH_INVALID",
		"UPLOAD_CLAIM_INVALID",
		"OPERATION_SCOPE_INVALID",
		"ACCEPTED_RELEASE_CHANGED",
		"MESSAGE_KEY_REUSED",
		"RUN_NOT_WRITABLE",
		"EVENT_CURSOR_INVALID",
		"CONTENT_UNAVAILABLE",
		"QUESTION_SUPERSEDED",
		"ANSWER_INVALID",
		"INTERPRETATION_NOT_FAILED",
		"REQUIRED_QUESTIONS_UNANSWERED",
		"INTERPRETATION_PENDING"
	]),
	message: string().min(1),
	requestId: ids.request,
	retryable: boolean(),
	details: record(string(), json())
}) });
//#endregion
//#region packages/contracts/src/permits.ts
const resourceFields = {
	resourceId: opaqueKey,
	access: _enum(["read", "write"])
};
const workflowResource = strictObject({
	kind: _enum([
		"snapshot",
		"workspace",
		"projectRepository",
		"dataset"
	]),
	...resourceFields
});
const invocationResource = discriminatedUnion("kind", [strictObject({
	kind: literal("snapshot"),
	resourceId: opaqueKey,
	access: literal("read")
}), strictObject({
	kind: literal("workspace"),
	...resourceFields
})]);
const common = {
	schemaVersion: literal("devmesh.permit.v1"),
	grantId: ids.grant,
	activationId: ids.activation,
	notBefore: timestamp,
	expiresAt: timestamp
};
const workflowOwner = strictObject({
	ownerKind: literal("workflowAttempt"),
	runId: ids.run,
	runEpoch: epoch,
	workId: ids.work,
	workEpoch: epoch,
	attemptId: ids.attempt
});
const invocationOwner = strictObject({
	ownerKind: literal("invocationAttempt"),
	invocationId: ids.invocation,
	invocationEpoch: epoch,
	invocationAttemptId: ids.invocationAttempt
});
discriminatedUnion("ownerKind", [workflowOwner, invocationOwner]);
discriminatedUnion("ownerKind", [workflowOwner.extend({
	...common,
	resources: array(workflowResource).min(1).max(64)
}), invocationOwner.extend({
	...common,
	resources: array(invocationResource).min(1).max(64)
})]).superRefine((permit, ctx) => {
	if (Date.parse(permit.expiresAt) <= Date.parse(permit.notBefore)) ctx.addIssue({
		code: "custom",
		path: ["expiresAt"],
		message: "expiresAt must follow notBefore"
	});
});
string().regex(/^"r[1-9][0-9]*"$/).refine((value) => Number.isSafeInteger(Number(value.slice(2, -1))), "Revision must be a safe integer");
strictObject({
	revision,
	reviewHash: sha256
});
//#endregion
//#region packages/contracts/src/outputs.ts
const relativeFile = string().min(1).max(512).refine((path) => !path.startsWith("/") && !path.includes("\\") && !path.includes(":") && path.split("/").every((part) => part !== "" && part !== "." && part !== ".."), "Expected a relative workspace file");
const sourceRef = discriminatedUnion("kind", [
	artifactRef.extend({ kind: literal("artifact") }),
	strictObject({
		kind: literal("message"),
		messageId: ids.message
	}),
	strictObject({
		kind: literal("requirement"),
		requirementId: ids.requirement,
		requirementRevision: revision
	})
]);
const requirement = strictObject({
	id: ids.requirement,
	statement: nonemptyText,
	sourceRefs: array(sourceRef).min(1),
	acceptance: array(nonemptyText).min(1)
});
const question = strictObject({
	id: ids.question,
	required: boolean(),
	reason: nonemptyText,
	blockingScope: array(ids.work),
	defaultOption: nonemptyText.optional()
});
const completionCheck = discriminatedUnion("kind", [
	strictObject({
		kind: literal("artifact-exists"),
		outputSlot: opaqueKey
	}),
	strictObject({
		kind: literal("schema-valid"),
		outputSlot: opaqueKey,
		schemaId: opaqueKey
	}),
	strictObject({
		kind: literal("commit-resolved"),
		outputSlot: opaqueKey
	}),
	strictObject({
		kind: literal("command-exit-zero"),
		checkId: ids.check
	}),
	strictObject({
		kind: literal("required-tests-pass"),
		checkId: ids.check
	}),
	strictObject({
		kind: literal("coverage-threshold"),
		lines: number().min(80).max(100),
		branches: number().min(70).max(100)
	}),
	strictObject({
		kind: literal("human-decision"),
		checkId: ids.check
	})
]);
const planDraft = strictObject({
	requirementRevision: revision,
	works: array(strictObject({
		workId: ids.work,
		workRevision: revision,
		role,
		goal: nonemptyText,
		inputRefs: array(discriminatedUnion("kind", [artifactRef.extend({ kind: literal("artifact") }), strictObject({
			kind: literal("output"),
			workId: ids.work,
			outputSlot: opaqueKey
		})])).max(64),
		outputSpec: array(strictObject({
			slot: opaqueKey,
			schemaId: opaqueKey
		})).min(1).max(64),
		completionChecks: array(completionCheck).min(1).max(64),
		dependencies: array(strictObject({
			workId: ids.work,
			requiredOutcome: _enum(["success", "completed-with-findings"])
		})).max(29),
		writeScope: array(relativeFile).max(64),
		estimatedResources: strictObject({
			cpu: number().positive().max(64),
			memoryMiB: revision,
			timeoutMs: revision
		}),
		requirementIds: array(ids.requirement).min(1).max(200)
	})).min(1).max(30)
});
const productOutput = strictObject({
	schemaVersion: literal("devmesh.requirements.v1"),
	role: literal("product"),
	requirements: array(requirement).min(1),
	assumptions: array(nonemptyText),
	questions: array(question)
});
const architectOutput = strictObject({
	schemaVersion: literal("devmesh.architecture.v1"),
	role: literal("architect"),
	interfaces: array(strictObject({
		name: opaqueKey,
		specificationRef: artifactRef
	})),
	planDraft,
	risks: array(nonemptyText),
	capabilityFit: strictObject({
		supported: boolean(),
		gaps: array(nonemptyText)
	})
});
const developerOutput = strictObject({
	schemaVersion: literal("devmesh.development-result.v1"),
	role: literal("developer"),
	baseCommit: gitCommit,
	resultCommit: gitCommit,
	changedFiles: array(relativeFile),
	checkRefs: array(artifactRef),
	unverified: array(nonemptyText),
	handoffProposal: strictObject({
		targetRole: role,
		goal: nonemptyText,
		artifactRefs: array(artifactRef),
		reason: nonemptyText
	}).nullable()
});
const commitReportRef = artifactRef.extend({ targetCommit: gitCommit });
discriminatedUnion("role", [
	productOutput,
	architectOutput,
	developerOutput,
	strictObject({
		schemaVersion: literal("devmesh.test-result.v1"),
		role: literal("tester"),
		targetCommit: gitCommit,
		caseResults: array(strictObject({
			checkId: ids.check,
			requirementIds: array(ids.requirement).min(1),
			status: _enum([
				"PASSED",
				"FAILED",
				"SKIPPED",
				"MISSING"
			]),
			reportRef: commitReportRef
		})).min(1),
		coverageRef: commitReportRef,
		defects: array(strictObject({
			id: opaqueKey,
			severity: _enum([
				"LOW",
				"MEDIUM",
				"HIGH",
				"CRITICAL"
			]),
			description: nonemptyText,
			evidenceRefs: array(artifactRef).min(1)
		})),
		buildRef: commitReportRef,
		previewRef: commitReportRef.optional()
	}).superRefine((result, ctx) => {
		if ([
			result.coverageRef,
			result.buildRef,
			...result.previewRef ? [result.previewRef] : [],
			...result.caseResults.map((c) => c.reportRef)
		].some((report) => report.targetCommit !== result.targetCommit)) ctx.addIssue({
			code: "custom",
			path: ["targetCommit"],
			message: "All reports must bind the exact targetCommit"
		});
	})
]);
strictObject({
	schemaVersion: literal("devmesh.work.v1"),
	operationId: ids.operation,
	runId: ids.run,
	workId: ids.work,
	workRevision: revision,
	attemptId: ids.attempt,
	endpointId: opaqueKey,
	endpointRevision: revision,
	grantId: ids.grant,
	activationId: ids.activation,
	runEpoch: number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	workEpoch: number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	requirementRevision: revision,
	planRevision: revision,
	inputManifestId: ids.manifest,
	roleSnapshotId: ids.roleSnapshot,
	originRole: role,
	targetRole: role,
	requestedOutputSchema: opaqueKey
});
strictObject({
	schemaVersion: literal("devmesh.invocation.v1"),
	operationId: ids.operation,
	invocationId: ids.invocation,
	invocationAttemptId: ids.invocationAttempt,
	invocationEpoch: number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	activationId: ids.activation,
	grantId: ids.grant,
	endpointId: opaqueKey,
	endpointRevision: revision,
	inputManifestRef: artifactRef,
	definitionSnapshotRef: artifactRef
});
strictObject({
	schemaVersion: literal("devmesh.input-manifest.v1"),
	requirements: array(strictObject({
		requirementId: ids.requirement,
		sha256
	})),
	interfaces: array(artifactRef),
	artifacts: array(artifactRef),
	codeCommit: gitCommit.nullable(),
	templateVersion: opaqueKey,
	checkConfigHash: sha256,
	decisionIds: array(ids.decision)
});
strictObject({
	runId: ids.run,
	ref: sourceRef,
	label: string().min(1).max(512),
	body: discriminatedUnion("kind", [strictObject({
		kind: literal("text"),
		text: string().max(2 * 1024 * 1024)
	}), strictObject({
		kind: literal("requirement"),
		requirement
	})])
}).superRefine((v, c) => {
	if (v.ref.kind === "requirement" ? v.body.kind !== "requirement" || v.body.requirement.id !== v.ref.requirementId : v.body.kind !== "text") c.addIssue({
		code: "custom",
		message: "Source body does not match reference"
	});
});
const inputLimits = Object.freeze({
	textCodePoints: 2e4,
	attachments: 3,
	attachmentBytes: 2 * 1024 * 1024,
	jsonBytes: 256 * 1024
});
const attachmentIds = array(ids.attachment).max(inputLimits.attachments).refine((v) => new Set(v).size === v.length, "Duplicate attachment IDs");
const attachmentName = string().regex(/^[^\x00-\x1f\x7f/\\:]{1,80}$/u).refine((v) => v.trim().length > 0 && v !== "." && v !== "..", "Invalid display name");
const initialInput = strictObject({
	text: union([inputText, literal("")]),
	attachmentIds
});
const createProjectInput = strictObject({
	initialRequest: initialInput,
	clientDraftId: uuid(),
	name: projectName.optional()
}).refine((v) => v.initialRequest.text.trim().length > 0 || v.initialRequest.attachmentIds.length > 0, "Input requires text or an attachment");
strictObject({
	kind: _enum(["ITERATION", "FIX"]),
	title: taskTitle,
	goal: initialInput,
	baseAcceptedReleaseId: ids.release,
	clientDraftId: uuid()
}).refine((v) => v.goal.text.trim().length > 0 || v.goal.attachmentIds.length > 0, "Input requires text or an attachment");
const saveMessageInput = strictObject({
	text: inputText.refine((v) => v.trim().length > 0, "Message cannot be blank"),
	attachmentIds,
	clientMessageId: uuid(),
	intentHint: _enum([
		"query",
		"change",
		"unsure"
	]).optional()
});
const uploadMetadata = strictObject({
	clientAttachmentId: uuid(),
	name: attachmentName
});
const attachmentView = strictObject({
	attachmentId: ids.attachment,
	clientAttachmentId: uuid(),
	name: attachmentName,
	byteSize: number().int().min(1).max(inputLimits.attachmentBytes),
	state: _enum(["READY", "REMOVED"]),
	createdAt: timestamp
});
const inputOperation = strictObject({
	operationId: ids.operation,
	status: operationStatus,
	result: record(string(), json()).nullable()
});
const inputOperationLookup = strictObject({
	principalId: opaqueKey,
	scope: opaqueKey,
	key: uuid(),
	operation: inputOperation.nullable()
});
strictObject({
	project: strictObject({
		projectId: ids.project,
		name: projectName,
		revision,
		acceptedReleaseId: ids.release.nullable()
	}),
	run: strictObject({
		runId: ids.run,
		projectId: ids.project,
		taskId: ids.userTask,
		resourceRevision: revision,
		runEpoch: revision,
		controlRevision: revision,
		phase: string(),
		controlGate: string(),
		terminalOutcome: string().nullable(),
		currentPlanRevision: revision.nullable(),
		currentRequirementRevision: revision.nullable(),
		eventSeq: epoch
	}),
	mode: _enum(["current", "history"]),
	membership: _enum([
		"owner",
		"operator",
		"viewer"
	]),
	allowedActions: array(_enum([
		"saveMessage",
		"createTask",
		"answerQuestions"
	])),
	preparation: strictObject({
		understandingAvailable: boolean(),
		requiredOpenQuestions: epoch,
		pending: boolean()
	}),
	eventCursor: epoch,
	messages: array(strictObject({
		messageId: ids.message,
		author: opaqueKey,
		bodyArtifactId: ids.artifact,
		clientMessageId: string(),
		createdAt: timestamp,
		attachmentIds,
		intentHint: _enum([
			"query",
			"change",
			"unsure"
		]).nullable(),
		text: union([inputText, literal("")])
	})).max(200),
	nextMessageCursor: string().nullable(),
	templateBaseline: strictObject({
		version: opaqueKey,
		baseCommit: string().regex(/^[a-f0-9]{40}$/)
	})
});
//#endregion
//#region packages/contracts/src/preparation.ts
const unique = (values) => new Set(values).size === values.length;
const preparationRole = _enum(["product", "architect"]);
const preparationQuestion = question.extend({
	prompt: inputText,
	sourceRefs: array(sourceRef).min(1).max(64),
	options: array(strictObject({
		id: opaqueKey,
		label: inputText
	})).max(32).default([])
}).superRefine((q, ctx) => {
	if (!unique(q.options.map((o) => o.id))) ctx.addIssue({
		code: "custom",
		path: ["options"],
		message: "Options must have unique IDs"
	});
	if (q.defaultOption !== void 0 && !q.options.some((o) => o.id === q.defaultOption)) ctx.addIssue({
		code: "custom",
		path: ["defaultOption"],
		message: "Default must name an available option"
	});
});
const understandingOutput = strictObject({
	schemaVersion: literal("devmesh.understanding.v1"),
	role: literal("product"),
	requirements: array(requirement).min(1).max(200),
	assumptions: array(inputText).max(100),
	questions: array(preparationQuestion).max(100),
	conflicts: array(strictObject({
		id: opaqueKey,
		description: inputText,
		sourceRefs: array(sourceRef).min(2).max(64),
		questionId: ids.question
	})).max(100)
}).superRefine((v, ctx) => {
	if (!unique(v.requirements.map((r) => r.id))) ctx.addIssue({
		code: "custom",
		path: ["requirements"],
		message: "Requirement IDs must be unique"
	});
	if (!unique(v.questions.map((q) => q.id))) ctx.addIssue({
		code: "custom",
		path: ["questions"],
		message: "Question IDs must be unique"
	});
	if (!unique(v.conflicts.map((c) => c.id))) ctx.addIssue({
		code: "custom",
		path: ["conflicts"],
		message: "Conflict IDs must be unique"
	});
	for (const [i, c] of v.conflicts.entries()) {
		if (!v.questions.some((q) => q.id === c.questionId && q.required)) ctx.addIssue({
			code: "custom",
			path: [
				"conflicts",
				i,
				"questionId"
			],
			message: "Conflicting sources require an explicit required question"
		});
		if (new Set(c.sourceRefs.map((ref) => ref.kind === "message" ? ref.messageId : ref.kind === "artifact" ? ref.artifactId : `${ref.requirementId}:${ref.requirementRevision}`)).size < 2) ctx.addIssue({
			code: "custom",
			path: [
				"conflicts",
				i,
				"sourceRefs"
			],
			message: "A conflict requires two distinct sources"
		});
	}
});
const answerQuestionsInput = strictObject({ answers: array(strictObject({
	questionId: ids.question,
	questionRevision: revision,
	value: json()
})).min(1).max(100) }).superRefine((v, ctx) => {
	if (!unique(v.answers.map((a) => a.questionId))) ctx.addIssue({
		code: "custom",
		path: ["answers"],
		message: "An answer batch must contain each question once"
	});
	if (new TextEncoder().encode(JSON.stringify(v)).byteLength > 128 * 1024) ctx.addIssue({
		code: "custom",
		message: "Answer batch exceeds 128 KiB"
	});
});
strictObject({ failedInterpretationOperationId: ids.operation });
strictObject({
	runId: ids.run,
	requirementRevision: revision.nullable(),
	understanding: understandingOutput.nullable(),
	questions: array(strictObject({
		questionId: ids.question,
		questionRevision: revision,
		requirementBasis: revision,
		state: _enum([
			"OPEN",
			"ANSWERED",
			"SUPERSEDED"
		]),
		content: preparationQuestion,
		answer: strictObject({
			answerId: opaqueKey,
			value: json(),
			actor: opaqueKey,
			createdAt: timestamp
		}).nullable()
	})).max(100),
	jobs: array(strictObject({
		jobId: ids.job,
		operationId: ids.operation,
		purpose: _enum([
			"UNDERSTAND",
			"INTERPRET",
			"PLAN"
		]),
		role: preparationRole,
		state: opaqueKey,
		retryOf: ids.job.nullable(),
		errorCode: opaqueKey.nullable(),
		resultArtifactId: ids.artifact.nullable()
	})).max(50),
	pendingInputCount: epoch,
	answerInterventions: epoch
});
strictObject({
	providerId: opaqueKey,
	model: opaqueKey,
	promptHash: sha256,
	providerHash: sha256,
	maxOutputTokens: number().int().positive().max(32768),
	tokenLimit: number().int().positive(),
	maxInputBytes: number().int().min(1024).max(2 * 1024 * 1024)
});
strictObject({
	schemaVersion: literal("devmesh.preparation.v1"),
	operationId: ids.operation,
	jobId: ids.job,
	preparationAttemptId: opaqueKey,
	runId: ids.run,
	runEpoch: epoch,
	activationId: ids.activation,
	grantId: ids.grant,
	endpointId: opaqueKey,
	endpointRevision: revision,
	role: preparationRole,
	inputHash: sha256,
	profileHash: sha256,
	basisHash: sha256
});
const preparationSource = strictObject({
	ref: sourceRef,
	contentHash: sha256,
	byteSize: number().int().nonnegative().max(2 * 1024 * 1024),
	label: string().min(1).max(512)
});
strictObject({
	schemaVersion: literal("devmesh.preparation-input.v1"),
	runId: ids.run,
	role: preparationRole,
	basisHash: sha256,
	requirementRevision: revision.nullable(),
	baseCommit: gitCommit,
	sources: array(preparationSource).min(1).max(256),
	answerIds: array(opaqueKey).max(1e3)
});
//#endregion
//#region packages/contracts/src/source-path.ts
const unsafeQualityPath = (v) => [...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || v.includes("\\") || v.includes(":");
const qualityPath = string().min(1).max(512).refine((v) => !unsafeQualityPath(v) && v.normalize("NFC") === v && v.split("/").every((p) => p !== "" && p !== "." && p !== ".." && !/[. ]$/.test(p)), "Canonical relative source path required");
//#endregion
//#region packages/contracts/src/delivery.ts
const previewImageLimits = {
	manifestBytes: 1024 * 1024,
	configBytes: 1024 * 1024,
	blobBytes: 64 * 1024 * 1024,
	totalBytes: 256 * 1024 * 1024,
	layers: 16
};
const digest$1 = string().regex(/^sha256:[a-f0-9]{64}$/);
const size = number().int().min(0).max(previewImageLimits.blobBytes);
const descriptor = object({
	mediaType: string(),
	digest: digest$1,
	size
});
object({
	schemaVersion: literal(2),
	mediaType: literal("application/vnd.oci.image.manifest.v1+json"),
	config: descriptor.extend({ mediaType: literal("application/vnd.oci.image.config.v1+json") }),
	layers: array(descriptor.extend({ mediaType: _enum(["application/vnd.oci.image.layer.v1.tar", "application/vnd.oci.image.layer.v1.tar+gzip"]) })).min(1).max(previewImageLimits.layers)
});
object({
	os: literal("linux"),
	architecture: _enum(["amd64", "arm64"]),
	config: object({ Labels: record(string(), string()) }),
	rootfs: object({
		type: literal("layers"),
		diff_ids: array(digest$1).min(1).max(previewImageLimits.layers)
	})
});
strictObject({
	schemaVersion: literal("devmesh.preview-image-identity.v1"),
	imageDigest: digest$1,
	configDigest: digest$1,
	targetCommit: gitCommit,
	buildArtifactHash: sha256,
	os: literal("linux"),
	architecture: _enum(["amd64", "arm64"]),
	layers: array(strictObject({
		digest: digest$1,
		diffId: digest$1,
		byteSize: size,
		expandedByteSize: size
	})).min(1).max(previewImageLimits.layers)
});
const baseData = {
	schemaVersion: literal("devmesh.data-plan.v1"),
	runId: ids.run,
	codeCommit: gitCommit,
	requirementRevision: revision,
	planRevision: revision,
	templateVersion: opaqueKey,
	checkConfigHash: sha256
};
const initialData = _enum(["EMPTY", "DEMO"]);
const deliveryDataPlan = discriminatedUnion("strategy", [
	strictObject({
		...baseData,
		strategy: literal("INITIAL"),
		initialData,
		sourceReleaseId: _null(),
		migrationRef: _null(),
		replacementDecisionId: _null()
	}),
	strictObject({
		...baseData,
		strategy: literal("PRESERVE_MIGRATE"),
		initialData: _null(),
		sourceReleaseId: ids.release,
		migrationRef: artifactRef,
		replacementDecisionId: _null()
	}),
	strictObject({
		...baseData,
		strategy: literal("REPLACE"),
		initialData,
		sourceReleaseId: ids.release,
		migrationRef: _null(),
		replacementDecisionId: ids.decision
	})
]);
const coreKeys = [
	"build",
	"image.manifest",
	"image.config",
	"data.plan",
	"run.instructions",
	"collaboration.record",
	"role.configuration"
];
const deliveryProfileFields = {
	producerId: opaqueKey,
	architecture: _enum(["amd64", "arm64"]),
	materials: array(strictObject({
		key: opaqueKey,
		path: qualityPath
	})).min(8).max(coreKeys.length + previewImageLimits.layers)
};
function validateProfile(p, c) {
	const fail = (message) => c.addIssue({
		code: "custom",
		message
	}), keys = p.materials.map((m) => m.key), paths = p.materials.map((m) => m.path.toLowerCase());
	if (new Set(keys).size !== keys.length || new Set(paths).size !== paths.length) fail("Unique delivery material keys and paths required");
	if (coreKeys.some((key) => !keys.includes(key))) fail("All fixed delivery materials required");
	const layers = keys.filter((key) => !coreKeys.includes(key)).sort((a, b) => Number(a.slice(12)) - Number(b.slice(12)));
	if (!layers.length || layers.some((key, index) => key !== "image.layer." + index)) fail("Contiguous bounded image layer outputs required");
}
function profileSchema() {
	return strictObject(deliveryProfileFields);
}
const releaseDeliveryProfile = profileSchema().superRefine(validateProfile);
strictObject({
	schemaVersion: literal("devmesh.delivery-policy.v1"),
	templateVersion: opaqueKey,
	checkConfigHash: sha256,
	...deliveryProfileFields
}).superRefine(validateProfile);
//#endregion
//#region packages/contracts/src/release-acceptance.ts
const acceptanceCandidateBasis = strictObject({
	candidateRevision: revision,
	manifestHash: sha256,
	reviewHash: sha256,
	expectedAcceptedReleaseId: ids.release.nullable(),
	dataPlanHash: sha256
});
acceptanceCandidateBasis.extend({ policyHash: sha256 });
acceptanceCandidateBasis.extend({
	decisionId: ids.decision,
	confirmation: literal("REPLACE_ACCEPTED_DATA")
});
strictObject({ requestHash: sha256 });
strictObject({
	requestHash: sha256,
	expectedPreparationRevision: revision,
	reason: string().trim().min(1).max(2e3),
	confirmation: literal("ABORT_ACCEPTANCE_PREPARATION")
});
const acceptCandidateInput = acceptanceCandidateBasis.extend({
	runId: ids.run,
	preparationOperationId: ids.operation,
	requestHash: sha256,
	expectedPreparationRevision: revision,
	expectedObservationSequence: revision,
	proofHash: sha256,
	confirmation: literal("ACCEPT_RELEASE")
});
acceptanceCandidateBasis.extend({
	projectId: ids.project,
	runId: ids.run,
	candidateId: ids.candidate,
	codeCommit: gitCommit,
	dataPlan: deliveryDataPlan,
	currentAcceptedReleaseId: ids.release.nullable(),
	resourceRevision: revision,
	qualification: _enum(["CURRENT", "STALE"]),
	configured: boolean(),
	policyHash: sha256.nullable(),
	replacementConfirmed: boolean(),
	blockedByPreparationOperationId: ids.operation.nullable(),
	canManage: boolean(),
	canPrepare: boolean(),
	canConfirmReplacement: boolean(),
	reason: _enum([
		"NOT_OWNER",
		"REVIEW_REQUIRED",
		"CANDIDATE_STALE",
		"SOURCE_CHANGED",
		"BACKEND_UNAVAILABLE",
		"REPLACEMENT_CONFIRMATION_REQUIRED",
		"PREPARATION_UNRESOLVED",
		"EFFECT_UNRESOLVED"
	]).nullable()
});
strictObject({
	items: array(strictObject({
		sequence: revision,
		preparation: strictObject({
			operationId: ids.operation,
			runId: ids.run,
			candidateId: ids.candidate,
			releaseId: ids.release,
			requestHash: sha256,
			revision,
			state: _enum([
				"PREPARED",
				"SENT",
				"UNKNOWN",
				"FAILED"
			]),
			resolution: _enum([
				"UNRESOLVED",
				"UNSENT_FAILED",
				"COMMITTED",
				"ABORTING",
				"ABORTED"
			]),
			qualification: _enum(["CURRENT", "STALE"]),
			basis: acceptanceCandidateBasis,
			createdAt: timestamp,
			updatedAt: timestamp,
			acceptanceOperationId: ids.operation.nullable(),
			readiness: strictObject({
				state: _enum([
					"UNPREPARED",
					"READY",
					"UNAVAILABLE",
					"STALE"
				]),
				sequence: number().int().nonnegative().safe(),
				proofHash: sha256.nullable(),
				checkedAt: timestamp.nullable()
			}),
			resourceRevision: revision,
			canCommit: boolean(),
			canCloseUnsent: boolean(),
			canAbort: boolean()
		})
	})).max(100),
	nextSequence: revision.nullable()
});
strictObject({
	decisionId: ids.decision,
	operationId: ids.operation
});
strictObject({
	operationId: ids.operation,
	preparationOperationId: ids.operation,
	decisionHash: sha256,
	reason: string().min(1).max(2e3),
	decidedAt: timestamp,
	decisionState: literal("RECORDED")
});
const acceptedReleaseView = strictObject({
	releaseId: ids.release,
	projectId: ids.project,
	runId: ids.run,
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	reviewHash: sha256,
	preparationOperationId: ids.operation,
	acceptanceOperationId: ids.operation,
	requestHash: sha256,
	proofHash: sha256,
	datasetId: ids.dataset,
	previousReleaseId: ids.release.nullable(),
	acceptedBy: opaqueKey,
	acceptedAt: timestamp,
	acceptanceState: literal("ACCEPTED"),
	publicationState: literal("PENDING")
});
strictObject({
	operationId: ids.operation,
	status: literal("SUCCEEDED"),
	result: acceptedReleaseView,
	links: strictObject({ preparation: string().regex(/^\/api\/v1\/runs\/run_[A-Za-z0-9_-]+\/candidates\/candidate_[A-Za-z0-9_-]+\/acceptance\/preparations\/op_[A-Za-z0-9_-]+$/) })
});
//#endregion
//#region packages/contracts/src/commands.ts
const idempotencyKey = uuid();
const commandBodies = {
	CreateProject: createProjectInput,
	SaveMessage: saveMessageInput,
	AnswerQuestions: answerQuestionsInput,
	ConfirmPlan: strictObject({
		requirementRevision: revision,
		reviewHash: sha256,
		carryForwardHash: sha256.optional()
	}),
	PlanFeedback: strictObject({
		text: inputText,
		workIds: array(ids.work).optional()
	}),
	ProposeChange: strictObject({
		proposedText: inputText,
		sourceMessageId: ids.message
	}),
	DecideChange: strictObject({
		action: _enum(["confirm", "reject"]),
		analysisId: ids.analysis,
		basisHash: sha256
	}),
	PauseRun: strictObject({ reason: nonemptyText.optional() }),
	ResumeRun: strictObject({
		controlRevision: revision,
		recoveryReviewHash: sha256
	}),
	CancelRun: strictObject({ impactReviewHash: sha256 }),
	RetryWork: strictObject({
		runId: ids.run,
		failedAttemptId: ids.attempt,
		retryReviewHash: sha256
	}),
	RedoRun: strictObject({ redoReviewHash: sha256 }),
	AcceptCandidate: acceptCandidateInput
};
const targets = {
	creation: strictObject({
		kind: literal("creation"),
		namespace: opaqueKey
	}),
	run: strictObject({
		kind: literal("run"),
		projectId: ids.project,
		runId: ids.run
	}),
	plan: strictObject({
		kind: literal("plan"),
		projectId: ids.project,
		runId: ids.run,
		planRevision: revision
	}),
	work: strictObject({
		kind: literal("work"),
		projectId: ids.project,
		workId: ids.work
	}),
	change: strictObject({
		kind: literal("change"),
		projectId: ids.project,
		changeId: ids.change
	}),
	candidate: strictObject({
		kind: literal("candidate"),
		projectId: ids.project,
		candidateId: ids.candidate
	})
};
discriminatedUnion("kind", [
	targets.creation,
	targets.run,
	targets.plan,
	targets.work,
	targets.change,
	targets.candidate
]);
const envelope = (type, target) => strictObject({
	schemaVersion: literal(1),
	type: literal(type),
	idempotencyKey,
	target: targets[target],
	payload: commandBodies[type]
});
discriminatedUnion("type", [
	envelope("CreateProject", "creation"),
	envelope("SaveMessage", "run"),
	envelope("AnswerQuestions", "run"),
	envelope("ConfirmPlan", "plan"),
	envelope("PlanFeedback", "plan"),
	envelope("ProposeChange", "run"),
	envelope("DecideChange", "change"),
	envelope("PauseRun", "run"),
	envelope("ResumeRun", "run"),
	envelope("CancelRun", "run"),
	envelope("RetryWork", "work"),
	envelope("RedoRun", "run"),
	envelope("AcceptCandidate", "candidate")
]);
const operationReceipt = strictObject({
	operationId: ids.operation,
	status: operationStatus,
	resource: strictObject({
		projectId: ids.project,
		runId: ids.run,
		revision
	}),
	links: strictObject({ operation: string().regex(/^\/api\/v1\/operations\/op_[A-Za-z0-9_-]+$/) }),
	result: record(string(), json()).optional()
});
//#endregion
//#region packages/contracts/src/plans.ts
const planIssue = strictObject({
	code: opaqueKey,
	path: string().min(1).max(512),
	workId: ids.work.optional(),
	relatedWorkId: ids.work.optional(),
	requirementId: ids.requirement.optional()
});
strictObject({
	projectId: ids.project,
	runId: ids.run,
	resourceRevision: revision,
	planRevision: revision,
	requirementRevision: revision,
	reviewHash: sha256,
	baseCommit: gitCommit,
	plan: planDraft,
	mode: _enum(["current", "history"]),
	canConfirm: boolean(),
	confirmation: strictObject({
		actor: opaqueKey,
		operationId: ids.operation,
		confirmedAt: timestamp
	}).nullable(),
	issues: array(planIssue),
	topology: array(strictObject({
		workId: ids.work,
		layer: number().int().min(0).max(29)
	})).max(30),
	carryForward: strictObject({
		sha256,
		round: number().int().min(1).max(2),
		sourcePlanRevision: revision,
		results: array(strictObject({
			workId: ids.work,
			workRevision: revision,
			attemptId: ids.attempt,
			sourcePlanRevision: revision,
			outcome: _enum(["success", "completed-with-findings"]),
			codeCommit: gitCommit.nullable(),
			evidence: artifactRef,
			checkConfigHash: sha256,
			templateVersion: opaqueKey,
			inputManifestSha256: sha256,
			snapshotSha256: sha256,
			origin: _enum(["FORMAL", "HISTORICAL"])
		})).max(30)
	}).optional()
});
strictObject({
	definitionId: opaqueKey,
	version: opaqueKey,
	stages: array(strictObject({
		stageId: opaqueKey,
		kind: _enum([
			"install",
			"unit",
			"e2e",
			"build",
			"preview"
		]),
		imageDigest: string().regex(/^[a-z0-9][a-z0-9._/:~-]*@sha256:[a-f0-9]{64}$/),
		resourceLimits: strictObject({
			cpu: number().positive().max(64),
			memoryMiB: number().int().min(64).max(131072),
			pids: number().int().min(16).max(256),
			temporaryMiB: number().int().min(16).max(10240),
			timeoutMs: number().int().min(100).max(6e5)
		}),
		networkPolicyRef: literal("none"),
		outputSpec: array(relativeFile).max(32)
	})).min(1).max(8)
}).superRefine((v, ctx) => {
	if (new Set(v.stages.map((s) => s.stageId)).size !== v.stages.length) ctx.addIssue({
		code: "custom",
		path: ["stages"],
		message: "Stage identities must be unique"
	});
});
//#endregion
//#region packages/contracts/src/quality.ts
const qualityLimits = {
	reportBytes: 8 * 1024 * 1024,
	files: 2048,
	positions: 2e5,
	tests: 2e4,
	jsonDepth: 48,
	jsonNodes: 5e5
};
const pattern = string().min(1).max(512).refine((v) => !unsafeQualityPath(v) && !v.startsWith("/") && !v.split("/").some((p) => p === ".." || p === "." || !p), "Relative bounded glob required");
const count = number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const qualityLocation = strictObject({
	start: strictObject({
		line: count.min(1),
		column: count
	}),
	end: strictObject({
		line: count.min(1),
		column: count
	})
}).refine((v) => v.start.line < v.end.line || v.start.line === v.end.line && v.start.column <= v.end.column, "Location must be ordered");
const qualityBranch = strictObject({
	type: opaqueKey,
	loc: qualityLocation,
	locations: array(qualityLocation.nullable()).min(1).max(128)
});
const image = string().regex(/^[a-z0-9][a-z0-9._/:~-]*@sha256:[a-f0-9]{64}$/);
const qualityTestIdentity = strictObject({
	path: qualityPath,
	fullName: string().min(1).max(4096),
	requirementIds: array(ids.requirement).min(1).max(128)
});
const qualityProducer = strictObject({
	producerId: opaqueKey,
	command: array(string().min(1).max(1024)).min(1).max(32),
	imageDigest: image,
	pathPrefixes: array(string().min(1).max(1024).refine((v) => !v.includes("\\") && !v.endsWith("/") && !v.includes("/../") && !v.includes("/./") && (/^[A-Za-z]:\//.test(v) || v.startsWith("/")), "Fixed absolute normalized prefix required")).max(8)
});
strictObject({
	schemaVersion: literal("devmesh.quality-policy.v1"),
	templateVersion: opaqueKey,
	delivery: releaseDeliveryProfile.optional(),
	producers: array(qualityProducer).min(1).max(16),
	reports: array(strictObject({
		reportId: opaqueKey,
		producerId: opaqueKey,
		format: _enum(["istanbul-v1", "vitest-json-v1"]),
		path: qualityPath,
		sourceInclude: array(pattern).max(32)
	})).min(1).max(32),
	checks: array(strictObject({
		checkId: opaqueKey,
		kind: _enum([
			"command",
			"tests",
			"coverage",
			"human"
		]),
		producerIds: array(opaqueKey).max(16),
		reportIds: array(opaqueKey).max(32),
		requiredTests: array(qualityTestIdentity).max(qualityLimits.tests)
	})).min(1).max(64),
	business: strictObject({
		include: array(pattern).min(1).max(32),
		exclude: array(strictObject({
			glob: pattern,
			reason: string().min(1).max(1024)
		})).max(32)
	}),
	thresholds: strictObject({
		lines: number().int().min(80).max(100),
		branches: number().int().min(70).max(100)
	}),
	zeroBranches: _enum(["reject", "complete-map-proves-none"])
}).superRefine((v, c) => {
	const fail = (message) => c.addIssue({
		code: "custom",
		message
	});
	for (const [label, values] of [
		["producer", v.producers.map((x) => x.producerId)],
		["report", v.reports.map((x) => x.reportId)],
		["check", v.checks.map((x) => x.checkId)]
	]) if (new Set(values).size !== values.length) fail("Duplicate " + label);
	const producers = new Set(v.producers.map((x) => x.producerId)), reports = new Map(v.reports.map((x) => [x.reportId, x]));
	for (const r of v.reports) {
		if (!producers.has(r.producerId)) fail("Unknown report producer");
		if (r.format === "istanbul-v1" !== Boolean(r.sourceInclude.length)) fail("Coverage source scope is required; tests cannot define coverage");
	}
	for (const check of v.checks) {
		if (new Set(check.producerIds).size !== check.producerIds.length || new Set(check.reportIds).size !== check.reportIds.length) fail("Duplicate check input");
		if (check.producerIds.some((p) => !producers.has(p)) || check.reportIds.some((r) => !reports.has(r))) fail("Unknown check input");
		if (check.reportIds.some((r) => !check.producerIds.includes(reports.get(r).producerId))) fail("Report outside check producer scope");
		if (check.kind === "human" && (check.producerIds.length || check.reportIds.length || check.requiredTests.length)) fail("Human check cannot claim automatic evidence");
		if (check.kind !== "human" && !check.producerIds.length) fail("Automatic check requires original producer");
		if (check.kind === "tests" && (!check.requiredTests.length || !check.reportIds.length || check.reportIds.some((r) => reports.get(r)?.format !== "vitest-json-v1"))) fail("Test check needs explicit test identities and raw test reports");
		if (check.kind === "coverage" && (!check.reportIds.length || check.reportIds.some((r) => reports.get(r)?.format !== "istanbul-v1"))) fail("Coverage check needs raw coverage reports");
		if (check.kind === "coverage" && v.reports.some((r) => r.format === "istanbul-v1" && !check.reportIds.includes(r.reportId))) fail("Overall coverage requires all configured producers");
		if (check.kind !== "tests" && check.requiredTests.length) fail("Unexpected test identities");
		if (check.kind === "command" && check.reportIds.length) fail("Command check uses execution facts only");
		const tests = check.requiredTests.map((t) => t.path + "\0" + t.fullName);
		if (new Set(tests).size !== tests.length) fail("Duplicate required test");
	}
	if (!v.checks.some((x) => x.kind === "coverage") || !v.checks.some((x) => x.kind === "tests")) fail("Policy requires independent test and coverage checks");
	for (const r of v.reports) if (!v.checks.some((x) => x.reportIds.includes(r.reportId))) fail("Unused required report");
	for (const p of v.producers) if (!v.checks.some((x) => x.producerIds.includes(p.producerId))) fail("Unused producer");
	if (v.delivery && (!producers.has(v.delivery.producerId) || !v.checks.some((x) => x.kind === "command" && x.producerIds.includes(v.delivery.producerId)))) fail("Delivery requires an original approved command check producer");
});
const qualitySourceFile = strictObject({
	path: qualityPath,
	sha256,
	lineLengths: array(count.max(1024 * 1024)).min(1).max(1e5)
});
strictObject({
	schemaVersion: literal("devmesh.quality-source.v1"),
	targetCommit: gitCommit,
	checkConfigHash: sha256,
	sourceManifestSha256: sha256,
	topologySha256: sha256,
	gitManifest: array(qualitySourceFile).max(qualityLimits.files),
	businessFiles: array(strictObject({
		path: qualityPath,
		statements: array(qualityLocation).max(qualityLimits.positions),
		branches: array(qualityBranch).max(qualityLimits.positions)
	})).max(qualityLimits.files)
});
strictObject({
	reportId: opaqueKey,
	execution: strictObject({
		producerId: opaqueKey,
		attemptId: ids.attempt,
		runnerId: opaqueKey,
		jobId: ids.job,
		operationId: ids.operation,
		requestHash: sha256,
		targetCommit: gitCommit,
		checkConfigHash: sha256,
		commandHash: sha256,
		imageDigest: image,
		state: _enum([
			"QUEUED",
			"STARTING",
			"RUNNING",
			"STOPPING",
			"EXITED",
			"OUTCOME_UNKNOWN"
		]),
		exitCode: number().int().min(-2147483648).max(2147483647).nullable(),
		errorCode: string().min(1).max(128).nullable(),
		stopRequested: boolean(),
		startedAt: timestamp.nullable(),
		finishedAt: timestamp.nullable(),
		log: strictObject({
			sha256,
			size: count.max(16 * 1024 * 1024)
		})
	}),
	outputPath: qualityPath,
	sha256,
	size: count.max(qualityLimits.reportBytes)
});
const qualityCheckStatus = _enum([
	"PASS",
	"FAIL",
	"MISSING",
	"STALE",
	"NOT_APPLICABLE",
	"PENDING"
]);
const metric = strictObject({
	covered: count,
	total: count,
	minimum: number().int().min(0).max(100),
	status: qualityCheckStatus
}).refine((v) => v.covered <= v.total, "Covered cannot exceed total");
strictObject({
	schemaVersion: literal("devmesh.quality-evaluation.v1"),
	targetCommit: gitCommit,
	checkConfigHash: sha256,
	sourceManifestSha256: sha256,
	topologySha256: sha256,
	automaticStatus: _enum([
		"PASS",
		"FAIL",
		"MISSING",
		"STALE"
	]),
	reviewStatus: _enum(["PENDING", "NOT_REQUIRED"]),
	checks: array(strictObject({
		checkId: opaqueKey,
		status: qualityCheckStatus,
		codes: array(opaqueKey).max(128),
		reportIds: array(opaqueKey).max(32),
		tests: strictObject({
			passed: count,
			failed: count,
			skipped: count,
			missing: count
		}).optional(),
		coverage: strictObject({
			lines: metric,
			branches: metric
		}).optional()
	})).max(64)
});
//#endregion
//#region packages/contracts/src/events.ts
const eventPayloads = {
	InputSaved: strictObject({ messageId: ids.message }),
	UnderstandingUpdated: strictObject({ understandingRef: artifactRef }),
	QuestionAnswered: strictObject({
		questionId: ids.question,
		questionRevision: revision
	}),
	PlanPublished: strictObject({
		planRevision: revision,
		planRef: artifactRef
	}),
	PlanConfirmed: strictObject({
		planRevision: revision,
		decisionId: ids.decision
	}),
	WorkAdmitted: strictObject({
		workId: ids.work,
		attemptId: ids.attempt,
		activationId: ids.activation
	}),
	AttemptStateChanged: strictObject({
		attemptId: ids.attempt,
		state: attemptState
	}),
	A2ATaskObserved: strictObject({
		attemptId: ids.attempt,
		endpointId: opaqueKey,
		taskId: protocolTaskId,
		state: a2aTaskState
	}),
	ToolOperationUpdated: strictObject({
		toolOperationId: ids.operation,
		status: operationStatus
	}),
	IssueChanged: strictObject({
		issueId: opaqueKey,
		issueRevision: revision,
		toolOperationId: ids.operation,
		toolName: _enum([
			"issues.create",
			"issues.linkFix",
			"issues.recordVerification"
		])
	}),
	PipelineChanged: strictObject({
		pipelineId: opaqueKey,
		toolOperationId: ids.operation,
		state: _enum([
			"QUEUED",
			"RUNNING",
			"SUCCEEDED",
			"FAILED",
			"STOPPING",
			"CANCELLED",
			"OUTCOME_UNKNOWN"
		])
	}),
	ArtifactRegistered: strictObject({ artifact: artifactRef }),
	ChangeApplied: strictObject({
		changeId: ids.change,
		requirementRevision: revision,
		planRevision: revision
	}),
	DecisionSaved: strictObject({ decisionId: ids.decision }),
	ControlProgress: strictObject({
		state: runState,
		controlRevision: revision,
		runEpoch: epoch
	}),
	ConfigurationApplied: strictObject({ configurationRef: artifactRef }),
	CandidateUpdated: strictObject({
		candidateId: ids.candidate,
		state: _enum([
			"PREPARING",
			"READY",
			"BLOCKED",
			"SUPERSEDED"
		])
	}),
	CandidateReviewRecorded: strictObject({
		candidateId: ids.candidate,
		resultId: opaqueKey
	}),
	CandidateRejected: strictObject({
		candidateId: ids.candidate,
		rejectionId: opaqueKey,
		resultId: opaqueKey,
		state: _enum(["OPEN", "WITHDRAWN"])
	}),
	DatasetStateChanged: strictObject({
		datasetId: ids.dataset,
		state: _enum([
			"PREPARING",
			"READY",
			"WRITE_FROZEN",
			"RETIRED",
			"MISSING"
		])
	}),
	PreviewOperationChanged: strictObject({
		previewId: ids.preview,
		state: _enum([
			"STARTING",
			"READY",
			"STOPPING",
			"STOPPED",
			"EXPIRED",
			"UNKNOWN"
		])
	}),
	AcceptancePreparationChanged: strictObject({
		preparationId: ids.operation,
		state: _enum([
			"PREPARED",
			"SENT",
			"UNKNOWN",
			"FAILED"
		])
	}),
	AcceptanceReadinessObserved: strictObject({
		preparationId: ids.operation,
		sequence: revision,
		state: _enum(["READY", "UNKNOWN"])
	}),
	AcceptanceAbortRequested: strictObject({
		preparationId: ids.operation,
		abortOperationId: ids.operation
	}),
	AcceptanceAbortCompleted: strictObject({
		preparationId: ids.operation,
		abortOperationId: ids.operation
	}),
	DatasetWriteGateClosed: strictObject({
		datasetId: ids.dataset,
		preparationId: ids.operation,
		fence: revision
	}),
	ReleaseAccepted: strictObject({
		candidateId: ids.candidate,
		releaseId: ids.release
	}),
	ReleasePublicationChanged: strictObject({
		releaseId: ids.release,
		state: _enum([
			"PENDING",
			"SENT",
			"UNKNOWN",
			"PUBLISHED"
		]),
		publicationRevision: revision,
		observationSequence: epoch,
		errorCode: opaqueKey.nullable()
	}),
	PreviewStateChanged: strictObject({
		previewId: ids.preview,
		state: _enum([
			"PREPARING",
			"RUNNING",
			"STOPPING",
			"STOPPED",
			"FAILED",
			"OUTCOME_UNKNOWN"
		])
	}),
	ExportUpdated: strictObject({
		exportId: ids.export,
		status: operationStatus
	})
};
const base = {
	schemaVersion: literal(1),
	eventId: ids.event,
	projectId: ids.project,
	runId: ids.run,
	seq: revision,
	occurredAt: timestamp,
	observedAt: timestamp,
	timeSource: _enum(["producer", "observed"]),
	resourceRevision: revision,
	requirementRevision: revision.nullable(),
	planRevision: revision.nullable(),
	operationId: ids.operation,
	workId: ids.work.optional(),
	attemptId: ids.attempt.optional()
};
const eventOf = (type) => strictObject({
	...base,
	type: literal(type),
	payload: eventPayloads[type]
});
discriminatedUnion("type", [
	eventOf("ReleasePublicationChanged"),
	eventOf("AcceptanceAbortRequested"),
	eventOf("AcceptanceAbortCompleted"),
	eventOf("InputSaved"),
	eventOf("UnderstandingUpdated"),
	eventOf("QuestionAnswered"),
	eventOf("PlanPublished"),
	eventOf("PlanConfirmed"),
	eventOf("WorkAdmitted"),
	eventOf("AttemptStateChanged"),
	eventOf("A2ATaskObserved"),
	eventOf("ToolOperationUpdated"),
	eventOf("ArtifactRegistered"),
	eventOf("ChangeApplied"),
	eventOf("DecisionSaved"),
	eventOf("ControlProgress"),
	eventOf("ConfigurationApplied"),
	eventOf("CandidateUpdated"),
	eventOf("ReleaseAccepted"),
	eventOf("PreviewStateChanged"),
	eventOf("ExportUpdated"),
	eventOf("IssueChanged"),
	eventOf("PipelineChanged"),
	eventOf("CandidateReviewRecorded"),
	eventOf("CandidateRejected"),
	eventOf("DatasetStateChanged"),
	eventOf("PreviewOperationChanged"),
	eventOf("AcceptancePreparationChanged"),
	eventOf("AcceptanceReadinessObserved"),
	eventOf("DatasetWriteGateClosed")
]).superRefine((event, ctx) => {
	if (event.timeSource === "observed" && event.occurredAt !== event.observedAt) ctx.addIssue({
		code: "custom",
		path: ["occurredAt"],
		message: "Observed time must equal occurredAt when no producer time exists"
	});
	const payload = event.payload;
	for (const key of [
		"attemptId",
		"workId",
		"planRevision",
		"requirementRevision"
	]) if (payload[key] !== void 0 && event[key] !== void 0 && payload[key] !== event[key]) ctx.addIssue({
		code: "custom",
		path: ["payload", key],
		message: "Payload and persisted envelope must agree"
	});
});
strictObject({
	kind: literal("token-delta"),
	streamId: opaqueKey,
	text: string()
});
//#endregion
//#region packages/contracts/src/candidate-review.ts
const text = string().trim().min(1).max(4096);
const status = _enum([
	"PASS",
	"FAIL",
	"MISSING",
	"STALE"
]);
const candidateReviewItem = strictObject({
	itemId: opaqueKey,
	itemHash: sha256,
	kind: _enum([
		"requirement",
		"work-human",
		"quality-human"
	]),
	requirementIds: array(ids.requirement),
	subjectId: opaqueKey,
	checkId: opaqueKey,
	expected: string().min(1).max(32768)
});
const candidateHumanResult = strictObject({
	resultId: opaqueKey,
	operationId: ids.operation,
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	item: candidateReviewItem,
	previousResultId: opaqueKey.nullable(),
	principalId: opaqueKey,
	verdict: _enum(["PASS", "FAIL"]),
	procedure: text,
	expected: string().min(1).max(32768),
	observed: text,
	evidence: array(artifactRef).max(16),
	createdAt: timestamp
});
const candidateRejectionResult = strictObject({
	resultId: opaqueKey,
	operationId: ids.operation,
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	rejectionId: opaqueKey,
	previousResultId: opaqueKey.nullable(),
	classification: _enum(["IN_SCOPE_DEFECT", "SCOPE_CHANGE"]),
	state: _enum(["OPEN", "WITHDRAWN"]),
	item: candidateReviewItem.nullable(),
	description: text,
	reason: text,
	evidence: array(artifactRef).max(16),
	principalId: opaqueKey,
	createdAt: timestamp,
	nextAction: _enum([
		"REPAIR_REVIEW_REQUIRED",
		"CHANGE_REVIEW_REQUIRED",
		"NONE"
	]),
	applicationState: literal("NOT_APPLIED")
});
const candidateReviewView = strictObject({
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	qualification: _enum(["CURRENT", "STALE"]),
	resourceRevision: revision,
	automaticStatus: literal("PASS"),
	humanStatus: status,
	reviewHash: sha256,
	items: array(candidateReviewItem.extend({
		status,
		result: candidateHumanResult.nullable()
	})).min(1).max(2048),
	automaticChecks: array(strictObject({
		operationId: ids.operation,
		checkId: opaqueKey,
		status: string(),
		codes: array(string())
	})),
	rejections: array(candidateRejectionResult).max(100),
	rejectionStatus: _enum(["OPEN", "NONE"]),
	canRecord: boolean(),
	canPrepareAcceptance: boolean(),
	canWithdrawRejections: boolean()
});
strictObject({
	runId: ids.run,
	codeCommit: gitCommit,
	review: candidateReviewView
});
candidateHumanResult.pick({
	manifestHash: true,
	previousResultId: true,
	verdict: true,
	procedure: true,
	expected: true,
	observed: true,
	evidence: true
}).extend({
	itemId: opaqueKey,
	itemHash: sha256
});
candidateRejectionResult.pick({
	manifestHash: true,
	rejectionId: true,
	previousResultId: true,
	classification: true,
	state: true,
	description: true,
	reason: true,
	evidence: true
}).extend({
	itemId: opaqueKey.nullable(),
	itemHash: sha256.nullable()
});
strictObject({
	items: array(strictObject({
		sequence: revision,
		result: candidateHumanResult
	})).max(100),
	nextSequence: revision.nullable()
});
strictObject({
	items: array(strictObject({
		sequence: revision,
		result: candidateRejectionResult
	})).max(100),
	nextSequence: revision.nullable()
});
strictObject({ format: literal("zip") });
strictObject({ expectedGeneration: number().int().nonnegative() });
strictObject({
	jobs: array(strictObject({
		exportId: opaqueKey,
		releaseId: opaqueKey,
		runId: opaqueKey,
		candidateId: opaqueKey,
		codeCommit: gitCommit,
		cutoffSeq: number().int().nonnegative(),
		snapshotHash: sha256,
		state: _enum([
			"QUEUED",
			"PACKING",
			"FAILED",
			"READY"
		]),
		generation: number().int().nonnegative(),
		leaseUntil: timestamp.nullable(),
		archiveHash: sha256.nullable(),
		archiveSize: number().int().nonnegative().nullable(),
		errorCode: string().nullable(),
		createdAt: timestamp,
		updatedAt: timestamp,
		canRetry: boolean()
	}).superRefine((v, ctx) => {
		if (v.archiveHash === null !== (v.archiveSize === null) || v.state === "READY" && v.archiveHash === null) ctx.addIssue({
			code: "custom",
			message: "Ready export requires exact archive metadata"
		});
	})).max(200),
	nextCursor: opaqueKey.nullable()
});
strictObject({
	releaseId: opaqueKey,
	runId: opaqueKey,
	candidateId: opaqueKey,
	codeCommit: gitCommit,
	acceptedAt: timestamp,
	isCurrentAccepted: boolean()
});
//#endregion
//#region packages/contracts/src/release-access.ts
const secureOrigin$1 = url().refine((value) => {
	try {
		const u = new URL(value);
		return u.protocol === "https:" && u.origin === value;
	} catch {
		return false;
	}
}, { message: "Expected canonical HTTPS origin" });
strictObject({});
strictObject({
	ticket: string().regex(/^dmr_ticket\.[A-Za-z0-9_-]{43}$/),
	releaseOrigin: secureOrigin$1,
	expiresAt: timestamp,
	sessionExpiresAt: timestamp
});
strictObject({
	release: strictObject({
		releaseId: ids.release,
		runId: ids.run,
		candidateId: ids.candidate,
		datasetId: ids.dataset,
		revision,
		state: _enum([
			"PENDING",
			"SENT",
			"UNKNOWN",
			"PUBLISHED"
		]),
		isCurrentAccepted: boolean(),
		publishedAt: timestamp.nullable()
	}),
	access: strictObject({
		state: _enum([
			"AVAILABLE",
			"NOT_CONFIGURED",
			"RECOVERING",
			"NOT_CURRENT"
		]),
		canWrite: boolean(),
		releaseOrigin: secureOrigin$1.nullable(),
		checkedAt: timestamp.nullable()
	})
}).superRefine((v, ctx) => {
	if (v.access.state === "AVAILABLE" !== (v.access.releaseOrigin !== null) || v.access.state === "AVAILABLE" !== (v.access.checkedAt !== null) || v.access.canWrite && v.access.state !== "AVAILABLE" || v.access.state === "AVAILABLE" && (!v.release.isCurrentAccepted || v.release.state !== "PUBLISHED")) ctx.addIssue({
		code: "custom",
		message: "Available access requires current published identity and a live check"
	});
});
//#endregion
//#region packages/contracts/src/preview.ts
const secureOrigin = url().refine((value) => {
	try {
		const u = new URL(value);
		return u.protocol === "https:" && u.origin === value;
	} catch {
		return false;
	}
}, { message: "Expected canonical HTTPS origin" });
strictObject({});
strictObject({
	ticket: string().regex(/^dmp_ticket\.[A-Za-z0-9_-]{43}$/),
	previewOrigin: secureOrigin,
	expiresAt: timestamp,
	sessionExpiresAt: timestamp
});
const previewEntryView = strictObject({
	preview: strictObject({
		previewId: ids.preview,
		runId: ids.run,
		candidateId: ids.candidate,
		datasetId: ids.dataset,
		revision,
		state: _enum([
			"STARTING",
			"READY",
			"STOPPING",
			"STOPPED",
			"EXPIRED",
			"UNKNOWN"
		]),
		expiresAt: timestamp,
		healthState: _enum([
			"HEALTHY",
			"UNHEALTHY",
			"CREATED",
			"EXITED",
			"REMOVED",
			"UNKNOWN"
		]),
		healthCheckedAt: timestamp.nullable()
	}),
	access: strictObject({
		state: _enum([
			"AVAILABLE",
			"NOT_CONFIGURED",
			"RECOVERING",
			"STARTING",
			"STOPPING",
			"STOPPED",
			"EXPIRED",
			"UNKNOWN"
		]),
		canWrite: boolean(),
		previewOrigin: secureOrigin.nullable()
	})
}).superRefine((value, ctx) => {
	if (value.access.state === "AVAILABLE" !== (value.access.previewOrigin !== null) || value.access.canWrite && value.access.state !== "AVAILABLE") ctx.addIssue({
		code: "custom",
		message: "Only available access has a preview origin or write authority"
	});
});
strictObject({
	manifestHash: sha256,
	policyHash: sha256
});
strictObject({
	manifestHash: sha256,
	datasetId: ids.dataset,
	expiresAt: timestamp
});
strictObject({
	previewRevision: revision,
	impactReviewHash: sha256,
	confirmation: literal("STOP_PREVIEW")
});
const previewDatasetManagement = strictObject({
	datasetId: ids.dataset,
	runId: ids.run,
	candidateId: ids.candidate,
	operationId: ids.operation,
	state: _enum([
		"PREPARING",
		"READY",
		"WRITE_FROZEN",
		"RETIRED",
		"MISSING"
	]),
	operationState: _enum([
		"PREPARED",
		"SENT",
		"UNKNOWN",
		"SUCCEEDED",
		"FAILED"
	]),
	revision,
	sourceDatasetId: ids.dataset.nullable(),
	sourceReleaseId: ids.release.nullable(),
	schemaRevision: opaqueKey,
	snapshotAt: timestamp.nullable(),
	retentionUntil: timestamp,
	createdAt: timestamp,
	canStart: boolean()
});
const previewManagement = previewEntryView.shape.preview.extend({
	operationId: ids.operation,
	impactReviewHash: sha256,
	stopOperationId: ids.operation.nullable(),
	canStop: boolean()
});
strictObject({
	projectId: ids.project,
	runId: ids.run,
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	qualification: _enum(["CURRENT", "STALE"]),
	resourceRevision: revision,
	dataPlan: deliveryDataPlan,
	canManage: boolean(),
	configured: boolean(),
	policyHash: sha256.nullable(),
	canCreateDataset: boolean(),
	hasPendingEffects: boolean(),
	datasets: array(strictObject({
		sequence: revision,
		dataset: previewDatasetManagement
	})).max(20),
	nextDatasetSequence: revision.nullable(),
	previews: array(strictObject({
		sequence: revision,
		preview: previewManagement
	})).max(20),
	nextPreviewSequence: revision.nullable()
}), { ...commandBodies };
ids.run, ids.run, ids.run, ids.run, ids.run, ids.change, ids.run, ids.run, ids.run, ids.work, ids.run, ids.candidate;
//#endregion
//#region packages/input-api/src/web/workbench-upload.ts
const uploadEnvelope = strictObject({
	key: uuid(),
	principalId: opaqueKey,
	scope: literal("uploads"),
	path: literal("/api/v1/attachments"),
	metadata: uploadMetadata,
	mime: _enum(["text/plain", "text/markdown"]),
	byteSize: number().int().min(1).max(inputLimits.attachmentBytes),
	contentHash: sha256,
	createdAt: timestamp
});
const uploadRecord = strictObject({
	key: uuid(),
	principalId: opaqueKey,
	envelope: uploadEnvelope,
	bytes: custom((v) => v instanceof Uint8Array).nullable(),
	revision,
	receipt: inputOperation.nullable(),
	observedAt: timestamp.nullable(),
	attachment: attachmentView.nullable(),
	verifiedAt: timestamp.nullable(),
	releasedAt: timestamp.nullable()
});
const uploadResponse = strictObject({
	attachment: attachmentView,
	operationId: ids.operation
});
const uploadLimits = Object.freeze({
	residentFiles: 32,
	records: 256
});
var UploadValidationError = class extends Error {
	code = "INVALID_UPLOAD";
	constructor() {
		super("Invalid attachment");
	}
};
const invalid$1 = () => {
	throw new UploadValidationError();
};
const digest = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))).map((n) => n.toString(16).padStart(2, "0")).join("");
/** Validate and copy the exact original bytes before any local transaction or HTTP. */
async function prepareUpload(principalId, file) {
	opaqueKey.parse(principalId);
	if (!(file instanceof File) || !attachmentName.safeParse(file.name).success || file.size < 1 || file.size > inputLimits.attachmentBytes) invalid$1();
	const suffix = file.name.toLowerCase().split(".").at(-1), mime = suffix === "txt" ? "text/plain" : suffix === "md" || suffix === "markdown" ? "text/markdown" : invalid$1();
	if (file.type && file.type !== mime) invalid$1();
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (bytes.byteLength !== file.size) invalid$1();
	try {
		if (new TextDecoder("utf-8", { fatal: true }).decode(bytes).includes("\0")) invalid$1();
	} catch {
		invalid$1();
	}
	const key = crypto.randomUUID(), createdAt = (/* @__PURE__ */ new Date()).toISOString();
	return uploadRecord.parse({
		key,
		principalId,
		envelope: {
			key,
			principalId,
			scope: "uploads",
			path: "/api/v1/attachments",
			metadata: {
				clientAttachmentId: crypto.randomUUID(),
				name: file.name
			},
			mime,
			byteSize: bytes.byteLength,
			contentHash: await digest(bytes),
			createdAt
		},
		bytes,
		revision: 1,
		receipt: null,
		observedAt: null,
		attachment: null,
		verifiedAt: null,
		releasedAt: null
	});
}
/** Hashing runs outside IDB transactions; admission compares these exact bytes again. */
async function verifyUploadBytes(value) {
	if (value.bytes !== null && await digest(value.bytes) !== value.envelope.contentHash) invalid$1();
	return value;
}
function sameUploadBytes(a, b) {
	return a === null || b === null ? a === b : a.byteLength === b.byteLength && a.every((n, i) => n === b[i]);
}
//#endregion
//#region packages/input-api/src/web/workbench-local.ts
const answerBasis = strictObject({
	requirementRevision: revision,
	questions: array(strictObject({
		questionId: ids.question,
		questionRevision: revision,
		optionIds: array(opaqueKey).max(32)
	})).max(100)
}).superRefine((v, c) => {
	if (new Set(v.questions.map((q) => q.questionId)).size !== v.questions.length || v.questions.some((q) => new Set(q.optionIds).size !== q.optionIds.length)) c.addIssue({
		code: "custom",
		message: "Duplicate answer basis"
	});
});
const draftContext = discriminatedUnion("form", [
	strictObject({
		principalId: opaqueKey,
		form: literal("project"),
		projectId: _null(),
		runId: _null(),
		basisRevision: _null()
	}),
	strictObject({
		principalId: opaqueKey,
		form: literal("message"),
		projectId: ids.project,
		runId: ids.run,
		basisRevision: revision
	}),
	strictObject({
		principalId: opaqueKey,
		form: literal("questions-answer"),
		projectId: ids.project,
		runId: ids.run,
		basisRevision: revision,
		basis: answerBasis
	}),
	strictObject({
		principalId: opaqueKey,
		form: literal("plan-confirm"),
		projectId: ids.project,
		runId: ids.run,
		basisRevision: revision,
		basis: strictObject({
			planRevision: revision,
			requirementRevision: revision,
			reviewHash: sha256,
			carryForwardHash: sha256.optional()
		})
	})
]);
const draftFields = strictObject({
	text: string().max(4e4),
	name: string().max(80),
	answers: array(answerQuestionsInput.shape.answers.element).max(100).optional()
});
const draftRecord = strictObject({
	key: string(),
	context: draftContext,
	revision,
	clientDraftId: uuid(),
	...draftFields.shape,
	uploadKeys: array(uuid()).max(3).refine((v) => new Set(v).size === v.length).optional(),
	updatedAt: timestamp,
	pendingKey: uuid().nullable(),
	closedKey: uuid().optional(),
	previousClosedKey: uuid().optional()
});
const envelopeBase = {
	key: uuid(),
	context: draftContext,
	draftRevision: revision,
	createdAt: timestamp
};
const commandEnvelope = discriminatedUnion("kind", [
	strictObject({
		...envelopeBase,
		kind: literal("project"),
		scope: literal("projects.create"),
		path: literal("/api/v1/projects"),
		ifMatch: _null(),
		body: createProjectInput
	}),
	strictObject({
		...envelopeBase,
		kind: literal("message"),
		scope: ids.run,
		path: string(),
		ifMatch: string(),
		body: saveMessageInput
	}),
	strictObject({
		...envelopeBase,
		kind: literal("questions-answer"),
		scope: ids.run,
		path: string(),
		ifMatch: string(),
		body: answerQuestionsInput
	}),
	strictObject({
		...envelopeBase,
		kind: literal("plan-confirm"),
		scope: ids.run,
		path: string(),
		ifMatch: string(),
		body: commandBodies.ConfirmPlan
	})
]).superRefine((v, c) => {
	if (v.kind !== v.context.form) c.addIssue({
		code: "custom",
		message: "Wrong command context"
	});
	if (v.kind === "message" && (v.context.form !== "message" || v.scope !== v.context.runId || v.path !== `/api/v1/runs/${v.context.runId}/messages` || v.ifMatch !== `"r${v.context.basisRevision}"`)) c.addIssue({
		code: "custom",
		message: "Wrong original request"
	});
	if (v.kind === "questions-answer") if (v.context.form !== "questions-answer" || v.scope !== v.context.runId || v.path !== `/api/v1/runs/${v.context.runId}/questions:answer` || v.ifMatch !== `"r${v.context.basisRevision}"`) c.addIssue({
		code: "custom",
		message: "Wrong answer request"
	});
	else for (const a of v.body.answers) {
		const q = v.context.basis.questions.find((q) => q.questionId === a.questionId);
		if (!q || q.questionRevision !== a.questionRevision || typeof a.value !== "string" || !a.value.trim() || q.optionIds.length && !q.optionIds.includes(a.value)) c.addIssue({
			code: "custom",
			message: "Answer differs from reviewed question"
		});
	}
	if (v.kind === "plan-confirm") {
		const b = v.context.form === "plan-confirm" ? v.context.basis : null;
		if (!b || v.context.form !== "plan-confirm" || v.scope !== v.context.runId || v.path !== `/api/v1/runs/${v.context.runId}/plans/${b.planRevision}:confirm` || v.ifMatch !== `"r${v.context.basisRevision}"` || v.body.requirementRevision !== b.requirementRevision || v.body.reviewHash !== b.reviewHash || v.body.carryForwardHash !== b.carryForwardHash) c.addIssue({
			code: "custom",
			message: "Wrong plan confirmation basis"
		});
	}
});
const staleOriginalProof = strictObject({
	reason: literal("STALE_BASIS"),
	key: uuid(),
	projectId: ids.project,
	runId: ids.run,
	resourceRevision: revision,
	workspaceReadAt: timestamp,
	lookupReadAt: timestamp,
	lookup: inputOperationLookup.extend({ operation: _null() })
});
const removedOriginalProof = strictObject({
	reason: literal("REMOVED_ATTACHMENT"),
	key: uuid(),
	attachment: attachmentView.extend({ state: literal("REMOVED") }),
	attachmentReadAt: timestamp,
	lookupReadAt: timestamp,
	lookup: inputOperationLookup.extend({ operation: _null() })
});
const removedClosure = removedOriginalProof.extend({ draftSnapshot: draftRecord });
const closedHistoryCursor = strictObject({
	rootKey: uuid(),
	anchorKey: uuid()
});
const commandRecord = strictObject({
	key: uuid(),
	formKey: string(),
	envelope: commandEnvelope,
	receipt: inputOperation.nullable(),
	observedAt: timestamp.nullable(),
	pendingForm: string().optional(),
	closure: discriminatedUnion("reason", [staleOriginalProof, removedClosure]).optional()
});
const contextKey = (c) => JSON.stringify([
	c.principalId,
	c.projectId,
	c.runId,
	c.form,
	c.basisRevision,
	...c.form === "plan-confirm" ? [
		c.basis.planRevision,
		c.basis.requirementRevision,
		c.basis.reviewHash,
		c.basis.carryForwardHash ?? null
	] : c.form === "questions-answer" ? [c.basis.requirementRevision, c.basis.questions.map((q) => [q.questionId, q.questionRevision])] : []
]);
const pendingScope = strictObject({
	principalId: opaqueKey,
	projectId: ids.project,
	runId: ids.run,
	form: _enum([
		"message",
		"questions-answer",
		"plan-confirm"
	])
});
const formKey = (c) => JSON.stringify([
	c.principalId,
	c.projectId,
	c.runId,
	c.form
]);
var WorkbenchLocalError = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.code = code;
	}
};
const invalid = () => {
	throw new WorkbenchLocalError("LOCAL_RECORD_INVALID");
};
const stable = (v) => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : x);
function validateDraftFields(c, value) {
	if (c.form !== "questions-answer") {
		if (value.answers !== void 0) invalid();
		return;
	}
	if (value.answers === void 0) return invalid();
	if (value.text !== "" || value.name !== "" || new Set(value.answers.map((a) => a.questionId)).size !== value.answers.length || new TextEncoder().encode(JSON.stringify({ answers: value.answers })).byteLength > 128 * 1024) invalid();
	for (const a of value.answers) {
		const q = c.basis.questions.find((q) => q.questionId === a.questionId);
		if (!q || q.questionRevision !== a.questionRevision || typeof a.value !== "string" || q.optionIds.length && !q.optionIds.includes(a.value)) invalid();
	}
}
/** Browser storage is a recovery aid; all server permissions still apply. */
async function openWorkbenchLocal(principalId) {
	opaqueKey.parse(principalId);
	const db = await new Promise((resolve, reject) => {
		let settled = false;
		const fail = (code) => {
			if (!settled) {
				settled = true;
				reject(new WorkbenchLocalError(code));
			}
		};
		let request;
		try {
			request = indexedDB.open("devmesh.workbench", 2);
		} catch {
			fail("STORAGE_UNAVAILABLE");
			return;
		}
		const timer = setTimeout(() => fail("STORAGE_UNAVAILABLE"), 1e4);
		request.onblocked = () => {
			clearTimeout(timer);
			fail("STORAGE_BLOCKED");
		};
		request.onerror = () => {
			clearTimeout(timer);
			fail("STORAGE_UNAVAILABLE");
		};
		request.onupgradeneeded = (e) => {
			if (settled) {
				request.transaction.abort();
				return;
			}
			try {
				if (e.oldVersion === 0) {
					request.result.createObjectStore("drafts", { keyPath: "key" });
					request.result.createObjectStore("commands", { keyPath: "key" }).createIndex("pendingForm", "pendingForm", { unique: true });
				}
				request.result.createObjectStore("uploads", { keyPath: "key" }).createIndex("principalId", "principalId");
			} catch {
				try {
					request.transaction?.abort();
				} catch {}
			}
		};
		request.onsuccess = () => {
			clearTimeout(timer);
			if (settled) {
				request.result.close();
				return;
			}
			settled = true;
			const database = request.result;
			try {
				const tx = database.transaction([
					"drafts",
					"commands",
					"uploads"
				], "readonly"), commands = tx.objectStore("commands"), uploads = tx.objectStore("uploads");
				if (tx.objectStore("drafts").keyPath !== "key" || commands.keyPath !== "key" || uploads.keyPath !== "key" || commands.index("pendingForm").keyPath !== "pendingForm" || !commands.index("pendingForm").unique || uploads.index("principalId").keyPath !== "principalId" || uploads.index("principalId").unique) throw Error("Invalid schema");
			} catch {
				database.close();
				reject(new WorkbenchLocalError("LOCAL_RECORD_INVALID"));
				return;
			}
			resolve(request.result);
		};
	});
	let closed = false;
	const close = () => {
		closed = true;
		db.close();
	};
	db.onversionchange = close;
	db.onclose = () => {
		closed = true;
	};
	function context(input) {
		const c = draftContext.parse(input);
		if (c.principalId !== principalId) invalid();
		return c;
	}
	function draft(value, c) {
		if (value === void 0) return null;
		const d = draftRecord.parse(value);
		validateDraftFields(c, d);
		if (d.key !== contextKey(c) || stable(d.context) !== stable(c) || d.closedKey && d.pendingKey || c.form === "questions-answer" && (d.text !== "" || d.name !== "" || d.answers === void 0) || c.form !== "questions-answer" && d.answers !== void 0 || c.form !== "project" && c.form !== "message" && (d.uploadKeys !== void 0 || d.previousClosedKey !== void 0) || d.previousClosedKey === d.closedKey && d.closedKey !== void 0) invalid();
		return d;
	}
	function success(envelope, result) {
		const r = object({
			projectId: ids.project,
			runId: ids.run,
			revision
		}).parse(result), c = envelope.context;
		if (c.form !== "project" && (r.projectId !== c.projectId || r.runId !== c.runId)) invalid();
		if (envelope.kind === "plan-confirm") {
			const p = object({ planRevision: revision }).parse(result);
			if (c.form !== "plan-confirm" || p.planRevision !== c.basis.planRevision) invalid();
		} else if (envelope.kind === "questions-answer") object({ interpretationOperationId: ids.operation }).parse(result);
		else object({ messageId: ids.message }).parse(result);
	}
	function command(value) {
		const v = commandRecord.parse(value), c = v.envelope.context;
		if (v.key !== v.envelope.key || c.principalId !== principalId || v.formKey !== formKey(c) || v.pendingForm !== void 0 && v.pendingForm !== v.formKey || v.pendingForm === void 0 !== (v.receipt?.status === "SUCCEEDED" || v.closure !== void 0) || v.receipt === null !== (v.observedAt === null)) invalid();
		const proof = v.closure;
		if (proof) {
			if (v.receipt !== null || proof.key !== v.key || proof.lookup.principalId !== c.principalId || proof.lookup.scope !== v.envelope.scope || proof.lookup.key !== v.key) invalid();
			if (proof.reason === "STALE_BASIS") {
				if (c.form === "project" || proof.projectId !== c.projectId || proof.runId !== c.runId || proof.resourceRevision <= c.basisRevision || Date.parse(proof.lookupReadAt) < Date.parse(proof.workspaceReadAt)) invalid();
			} else {
				const e = v.envelope, ids = e.kind === "project" ? e.body.initialRequest.attachmentIds : e.kind === "message" ? e.body.attachmentIds : [];
				if (e.kind !== "project" && e.kind !== "message" || !ids.includes(proof.attachment.attachmentId) || Date.parse(proof.lookupReadAt) < Date.parse(proof.attachmentReadAt)) invalid();
				const d = draft(proof.draftSnapshot, c);
				if (!d) return invalid();
				if (d.pendingKey !== v.key || d.closedKey || d.revision !== e.draftRevision + 1) invalid();
				if (e.kind === "project" && (d.clientDraftId !== e.body.clientDraftId || d.text !== e.body.initialRequest.text || d.name !== (e.body.name ?? ""))) invalid();
				if (e.kind === "message" && (d.clientDraftId !== e.body.clientMessageId || d.text !== e.body.text)) invalid();
			}
		}
		if (v.receipt?.status === "SUCCEEDED") success(v.envelope, v.receipt.result);
		return v;
	}
	function transaction(mode, body) {
		if (closed) return Promise.reject(new WorkbenchLocalError("STORAGE_CLOSED"));
		return new Promise((resolve, reject) => {
			let tx;
			try {
				tx = db.transaction([
					"drafts",
					"commands",
					"uploads"
				], mode);
			} catch {
				reject(new WorkbenchLocalError("STORAGE_UNAVAILABLE"));
				return;
			}
			let result, ready = false, reason;
			const guard = (work) => {
				try {
					work();
				} catch (e) {
					reason = e;
					tx.abort();
				}
			};
			tx.oncomplete = () => {
				if (ready) resolve(result);
				else reject(new WorkbenchLocalError("LOCAL_RECORD_INVALID"));
			};
			tx.onabort = () => reject(reason instanceof WorkbenchLocalError ? reason : new WorkbenchLocalError(reason ? "LOCAL_RECORD_INVALID" : "STORAGE_UNAVAILABLE"));
			const s = {
				drafts: tx.objectStore("drafts"),
				commands: tx.objectStore("commands"),
				uploads: tx.objectStore("uploads"),
				get(store, key, next) {
					const r = store.get(key);
					r.onsuccess = () => guard(() => next(r.result));
				},
				all(store, key, next) {
					const r = store.getAll(key);
					r.onsuccess = () => guard(() => next(r.result));
				},
				scan(range, next) {
					const r = tx.objectStore("drafts").openCursor(range, "prev");
					r.onsuccess = () => guard(() => next(r.result));
				}
			};
			guard(() => body(s, (value) => {
				result = value;
				ready = true;
			}));
		});
	}
	function pending(s, c, next) {
		s.get(s.commands.index("pendingForm"), formKey(c), (raw) => {
			if (raw === void 0) {
				next(null);
				return;
			}
			const p = command(raw);
			if (p.pendingForm !== formKey(c) || p.formKey !== formKey(c)) invalid();
			s.get(s.drafts, contextKey(p.envelope.context), (rawDraft) => {
				const d = draft(rawDraft, p.envelope.context);
				if (!d || d.pendingKey !== p.key || d.revision !== p.envelope.draftRevision + 1) invalid();
				next(p);
			});
		});
	}
	function load(input) {
		const c = context(input);
		return transaction("readonly", (s, done) => s.get(s.drafts, contextKey(c), (raw) => {
			const d = draft(raw, c);
			pending(s, c, (p) => {
				if (d?.pendingKey && p?.key !== d.pendingKey) invalid();
				done({
					draft: d,
					pending: p
				});
			});
		}));
	}
	/** Recover an existing Run command even when no fresh form basis is readable. */
	function getPending(input) {
		const c = pendingScope.parse(input);
		if (c.principalId !== principalId) return invalid();
		return transaction("readonly", (s, done) => pending(s, c, done));
	}
	/** Old basis drafts are references, never silently copied into a new request. */
	function references(input, afterKey) {
		const c = context(input), prefix = formKey(c).slice(0, -1) + ",";
		if (afterKey !== void 0 && (!afterKey.startsWith(prefix) || afterKey.length > 65536)) return invalid();
		return transaction("readonly", (s, done) => {
			const items = [], range = IDBKeyRange.bound(prefix, afterKey ?? prefix + "￿", false, afterKey !== void 0);
			let scanned = 0;
			s.scan(range, (cursor) => {
				if (!cursor) {
					done({
						items,
						nextCursor: null
					});
					return;
				}
				const raw = draftRecord.parse(cursor.value), d = draft(raw, context(raw.context));
				if (!d || formKey(d.context) !== formKey(c)) return invalid();
				scanned++;
				if (d.context.basisRevision !== c.basisRevision && (d.text || d.name || d.answers?.length || d.closedKey || d.previousClosedKey)) items.push(d);
				if (items.length === 10 || scanned === 50) {
					done({
						items,
						nextCursor: String(cursor.key)
					});
					return;
				}
				cursor.continue();
			});
		});
	}
	function save(input, expectedRevision, fields) {
		const c = context(input), value = draftFields.parse(fields);
		validateDraftFields(c, value);
		number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1).parse(expectedRevision);
		return transaction("readwrite", (s, done) => pending(s, c, (p) => {
			if (p) throw new WorkbenchLocalError("COMMAND_PENDING");
			s.get(s.drafts, contextKey(c), (raw) => {
				const old = draft(raw, c);
				if (old?.closedKey) throw new WorkbenchLocalError("COMMAND_CLOSED");
				if (old?.pendingKey) invalid();
				if ((old?.revision ?? 0) !== expectedRevision) throw new WorkbenchLocalError("LOCAL_CONFLICT");
				const d = draftRecord.parse({
					key: contextKey(c),
					context: c,
					revision: expectedRevision + 1,
					clientDraftId: old?.clientDraftId ?? crypto.randomUUID(),
					...value,
					...old?.uploadKeys ? { uploadKeys: old.uploadKeys } : {},
					...old?.previousClosedKey ? { previousClosedKey: old.previousClosedKey } : {},
					updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
					pendingKey: null
				});
				s.drafts.put(d);
				done(d);
			});
		}));
	}
	async function enqueue(input, expectedRevision, expectedUploads = []) {
		const c = context(input);
		revision.parse(expectedRevision);
		if (expectedUploads.length > 3 || new Set(expectedUploads.map((v) => v.key)).size !== expectedUploads.length) return invalid();
		const verified = await Promise.all(expectedUploads.map((v) => verifyUploadBytes(upload(v))));
		return transaction("readwrite", (s, done) => pending(s, c, (p) => {
			if (p) throw new WorkbenchLocalError("COMMAND_PENDING");
			s.get(s.drafts, contextKey(c), (raw) => {
				const d = draft(raw, c);
				if (d?.closedKey) throw new WorkbenchLocalError("COMMAND_CLOSED");
				if (!d || d.revision !== expectedRevision) throw new WorkbenchLocalError("LOCAL_CONFLICT");
				if (d.pendingKey) invalid();
				if (stable(d.uploadKeys ?? []) !== stable(verified.map((v) => v.key))) throw new WorkbenchLocalError("UPLOAD_NOT_READY");
				selected(s, d, (uploads) => {
					for (let i = 0; i < uploads.length; i++) if (!sameUpload(uploads[i], verified[i])) throw new WorkbenchLocalError("LOCAL_CONFLICT");
					const attachmentIds = uploads.map((v) => {
						if (v.receipt?.status !== "SUCCEEDED" || v.attachment?.state !== "READY" || !v.verifiedAt) throw new WorkbenchLocalError("UPLOAD_NOT_READY");
						return v.attachment.attachmentId;
					});
					if (new Set(attachmentIds).size !== attachmentIds.length) return invalid();
					const key = crypto.randomUUID(), createdAt = (/* @__PURE__ */ new Date()).toISOString(), common = {
						key,
						context: c,
						draftRevision: d.revision,
						createdAt
					};
					if (c.form === "plan-confirm" && (d.text !== "CONFIRM_PLAN" || d.name !== "")) return invalid();
					const envelope = commandEnvelope.parse(c.form === "project" ? {
						...common,
						kind: "project",
						scope: "projects.create",
						path: "/api/v1/projects",
						ifMatch: null,
						body: {
							initialRequest: {
								text: d.text,
								attachmentIds
							},
							clientDraftId: d.clientDraftId,
							...d.name ? { name: d.name } : {}
						}
					} : c.form === "message" ? {
						...common,
						kind: "message",
						scope: c.runId,
						path: `/api/v1/runs/${c.runId}/messages`,
						ifMatch: `"r${c.basisRevision}"`,
						body: {
							text: d.text,
							attachmentIds,
							clientMessageId: d.clientDraftId
						}
					} : c.form === "questions-answer" ? {
						...common,
						kind: "questions-answer",
						scope: c.runId,
						path: `/api/v1/runs/${c.runId}/questions:answer`,
						ifMatch: `"r${c.basisRevision}"`,
						body: { answers: d.answers }
					} : {
						...common,
						kind: "plan-confirm",
						scope: c.runId,
						path: `/api/v1/runs/${c.runId}/plans/${c.basis.planRevision}:confirm`,
						ifMatch: `"r${c.basisRevision}"`,
						body: {
							requirementRevision: c.basis.requirementRevision,
							reviewHash: c.basis.reviewHash,
							...c.basis.carryForwardHash ? { carryForwardHash: c.basis.carryForwardHash } : {}
						}
					});
					const v = commandRecord.parse({
						key,
						formKey: formKey(c),
						pendingForm: formKey(c),
						envelope,
						receipt: null,
						observedAt: null
					}), updated = draftRecord.parse({
						...d,
						revision: d.revision + 1,
						pendingKey: key,
						updatedAt: createdAt
					});
					s.commands.add(v);
					s.drafts.put(updated);
					done({
						draft: updated,
						command: v
					});
				});
			});
		}));
	}
	function getCommand(key) {
		uuid().parse(key);
		return transaction("readonly", (s, done) => s.get(s.commands, key, (raw) => {
			if (raw === void 0) {
				done(null);
				return;
			}
			const v = commandRecord.parse(raw);
			done(v.envelope.context.principalId === principalId ? command(v) : null);
		}));
	}
	function observe(key, input) {
		uuid().parse(key);
		const parsed = union([inputOperation, operationReceipt]).safeParse(input);
		if (!parsed.success) return invalid();
		const value = parsed.data;
		if ("resource" in value) {
			const result = object({
				projectId: ids.project,
				runId: ids.run,
				revision
			}).safeParse(value.result);
			if (!result.success || value.resource.projectId !== result.data.projectId || value.resource.runId !== result.data.runId || value.resource.revision !== result.data.revision || value.links.operation !== `/api/v1/operations/${value.operationId}`) return invalid();
		}
		const receipt = inputOperation.parse({
			operationId: value.operationId,
			status: value.status,
			result: value.result ?? null
		});
		return transaction("readwrite", (s, done) => s.get(s.commands, key, (raw) => {
			const old = command(raw), c = old.envelope.context;
			if (old.closure) throw new WorkbenchLocalError("LOCAL_CONFLICT");
			if (old.receipt && old.receipt.operationId !== receipt.operationId) invalid();
			if (old.receipt?.status === "SUCCEEDED") {
				if (stable(old.receipt) !== stable(receipt)) invalid();
				done(old);
				return;
			}
			const observedAt = (/* @__PURE__ */ new Date()).toISOString();
			if (receipt.status !== "SUCCEEDED") {
				const v = commandRecord.parse({
					...old,
					receipt,
					observedAt
				});
				s.commands.put(v);
				done(v);
				return;
			}
			success(old.envelope, receipt.result);
			s.get(s.drafts, contextKey(c), (rawDraft) => {
				const d = draft(rawDraft, c);
				if (!d || d.pendingKey !== key || d.revision !== old.envelope.draftRevision + 1) return invalid();
				const { pendingForm: _pendingForm, ...rest } = old, v = commandRecord.parse({
					...rest,
					receipt,
					observedAt
				});
				s.commands.put(v);
				s.drafts.put(draftRecord.parse({
					...d,
					revision: d.revision + 1,
					text: "",
					name: "",
					...c.form === "questions-answer" ? { answers: [] } : {},
					...d.uploadKeys ? { uploadKeys: [] } : {},
					clientDraftId: crypto.randomUUID(),
					pendingKey: null,
					updatedAt: observedAt
				}));
				done(v);
			});
		}));
	}
	function closeStale(expected, input) {
		const snapshot = command(expected), proof = staleOriginalProof.parse(input), c = snapshot.envelope.context;
		if (c.form === "project" || snapshot.receipt || snapshot.closure || proof.key !== snapshot.key || proof.lookup.principalId !== c.principalId || proof.lookup.scope !== snapshot.envelope.scope || proof.lookup.key !== snapshot.key || proof.projectId !== c.projectId || proof.runId !== c.runId || proof.resourceRevision <= c.basisRevision || Date.parse(proof.lookupReadAt) < Date.parse(proof.workspaceReadAt)) return invalid();
		return transaction("readwrite", (s, done) => s.get(s.commands, snapshot.key, (raw) => {
			const old = command(raw);
			if (stable(old) !== stable(snapshot)) throw new WorkbenchLocalError("LOCAL_CONFLICT");
			pending(s, c, (p) => {
				if (!p || p.key !== old.key) throw new WorkbenchLocalError("LOCAL_CONFLICT");
				s.get(s.drafts, contextKey(c), (rawDraft) => {
					const d = draft(rawDraft, c);
					if (!d) return invalid();
					if (d.pendingKey !== old.key || d.revision !== old.envelope.draftRevision + 1 || d.closedKey) return invalid();
					const { pendingForm: _pendingForm, ...rest } = old, v = commandRecord.parse({
						...rest,
						closure: proof
					});
					s.commands.put(v);
					s.drafts.put(draftRecord.parse({
						...d,
						revision: d.revision + 1,
						pendingKey: null,
						closedKey: old.key,
						updatedAt: proof.lookupReadAt
					}));
					done(v);
				});
			});
		}));
	}
	/** A removed original is historical only after a protected ordered proof and exact native CAS. */
	function closeRemoved(expected, expectedDraft, input) {
		const snapshot = command(expected), c = snapshot.envelope.context, proof = removedOriginalProof.parse(input), d = draft(expectedDraft, c);
		if (snapshot.receipt || snapshot.closure || !d) return invalid();
		const { pendingForm: _pendingForm, ...rest } = snapshot, value = command({
			...rest,
			closure: {
				...proof,
				draftSnapshot: d
			}
		});
		return transaction("readwrite", (s, done) => s.get(s.commands, snapshot.key, (raw) => {
			if (stable(command(raw)) !== stable(snapshot)) throw new WorkbenchLocalError("LOCAL_CONFLICT");
			pending(s, c, (p) => {
				if (!p || p.key !== snapshot.key) throw new WorkbenchLocalError("LOCAL_CONFLICT");
				s.get(s.drafts, contextKey(c), (rawDraft) => {
					const current = draft(rawDraft, c);
					if (!current || stable(current) !== stable(d)) throw new WorkbenchLocalError("LOCAL_CONFLICT");
					s.commands.put(value);
					s.drafts.put(draftRecord.parse({
						...current,
						revision: current.revision + 1,
						pendingKey: null,
						closedKey: value.key,
						updatedAt: proof.lookupReadAt
					}));
					done(value);
				});
			});
		}));
	}
	/** Explicit blank start preserves the complete closed original; it never sends or copies input. */
	function startBlankInput(expectedClosed, expectedDraft) {
		const original = command(expectedClosed), proof = original.closure, c = original.envelope.context, d = draft(expectedDraft, c);
		if (!proof || proof.reason !== "REMOVED_ATTACHMENT" || !d || c.form !== "project" && c.form !== "message") return invalid();
		const expected = draftRecord.parse({
			...proof.draftSnapshot,
			revision: proof.draftSnapshot.revision + 1,
			pendingKey: null,
			closedKey: original.key,
			updatedAt: proof.lookupReadAt
		});
		if (stable(d) !== stable(expected)) return invalid();
		return transaction("readwrite", (s, done) => s.get(s.commands, original.key, (raw) => {
			if (stable(command(raw)) !== stable(original)) throw new WorkbenchLocalError("LOCAL_CONFLICT");
			pending(s, c, (p) => {
				if (p) throw new WorkbenchLocalError("COMMAND_PENDING");
				s.get(s.drafts, contextKey(c), (rawDraft) => {
					const current = draft(rawDraft, c);
					if (!current || stable(current) !== stable(d)) throw new WorkbenchLocalError("LOCAL_CONFLICT");
					const value = draftRecord.parse({
						key: d.key,
						context: c,
						revision: d.revision + 1,
						clientDraftId: crypto.randomUUID(),
						text: "",
						name: "",
						uploadKeys: [],
						updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
						pendingKey: null,
						previousClosedKey: original.key
					});
					s.drafts.put(value);
					done(value);
				});
			});
		}));
	}
	/** Bounded immutable links, with rank checked again across the pagination anchor. */
	function closedHistory(input, after) {
		const c = context(input), cursor = after === void 0 ? null : closedHistoryCursor.parse(after);
		if (c.form !== "project" && c.form !== "message") return invalid();
		return transaction("readonly", (s, done) => s.get(s.drafts, contextKey(c), (raw) => {
			const d = draft(raw, c), items = [];
			function item(raw) {
				const v = command(raw);
				if (contextKey(v.envelope.context) !== contextKey(c) || v.closure?.reason !== "REMOVED_ATTACHMENT") return invalid();
				return {
					...v,
					closure: v.closure
				};
			}
			function begin(rootKey) {
				if (!rootKey) {
					if (cursor) return invalid();
					done({
						items,
						nextCursor: null
					});
					return;
				}
				if (cursor && cursor.rootKey !== rootKey) throw new WorkbenchLocalError("LOCAL_CONFLICT");
				s.get(s.commands, rootKey, (rawRoot) => {
					const root = item(rawRoot);
					function walk(key, upper) {
						if (!key) {
							done({
								items,
								nextCursor: null
							});
							return;
						}
						s.get(s.commands, key, (rawItem) => {
							const v = item(rawItem);
							if (upper !== null && v.envelope.draftRevision >= upper) return invalid();
							items.push(v);
							const next = v.closure.draftSnapshot.previousClosedKey;
							if (items.length === 10) {
								done({
									items,
									nextCursor: next ? {
										rootKey,
										anchorKey: v.key
									} : null
								});
								return;
							}
							walk(next, v.envelope.draftRevision);
						});
					}
					if (!cursor) {
						walk(rootKey, null);
						return;
					}
					s.get(s.commands, cursor.anchorKey, (rawAnchor) => {
						const anchor = item(rawAnchor);
						if (anchor.key !== root.key && anchor.envelope.draftRevision >= root.envelope.draftRevision) return invalid();
						walk(anchor.closure.draftSnapshot.previousClosedKey, anchor.envelope.draftRevision);
					});
				});
			}
			if (!d) {
				begin(void 0);
				return;
			}
			if (!d.closedKey) {
				begin(d.previousClosedKey);
				return;
			}
			s.get(s.commands, d.closedKey, (rawClosed) => {
				const closed = command(rawClosed);
				if (contextKey(closed.envelope.context) !== contextKey(c) || !closed.closure) return invalid();
				begin(closed.closure.reason === "REMOVED_ATTACHMENT" ? closed.key : d.previousClosedKey);
			});
		}));
	}
	function upload(value) {
		const v = uploadRecord.parse(value), e = v.envelope, r = v.receipt, a = v.attachment;
		const suffix = e.metadata.name.toLowerCase().split(".").at(-1);
		if ((suffix === "txt" ? "text/plain" : suffix === "md" || suffix === "markdown" ? "text/markdown" : null) !== e.mime) return invalid();
		if (v.key !== e.key || v.principalId !== principalId || e.principalId !== principalId || r === null !== (v.observedAt === null) || a === null !== (v.verifiedAt === null) || v.bytes === null !== (v.releasedAt !== null) || v.bytes !== null && v.bytes.byteLength !== e.byteSize || v.bytes === null && r?.status !== "SUCCEEDED" && r?.status !== "FAILED") invalid();
		if (r?.status === "SUCCEEDED") {
			const result = strictObject({ attachmentId: ids.attachment }).parse(r.result);
			if (a && (a.attachmentId !== result.attachmentId || a.clientAttachmentId !== e.metadata.clientAttachmentId || a.name !== e.metadata.name || a.byteSize !== e.byteSize)) invalid();
		} else if (a) invalid();
		return v;
	}
	function sameUpload(a, b) {
		const { bytes: x, ...left } = a, { bytes: y, ...right } = b;
		return stable(left) === stable(right) && sameUploadBytes(x, y);
	}
	function selected(s, d, next) {
		const result = [], keys = d.uploadKeys ?? [];
		const step = () => {
			if (result.length === keys.length) {
				next(result);
				return;
			}
			s.get(s.uploads, keys[result.length], (raw) => {
				result.push(upload(raw));
				step();
			});
		};
		step();
	}
	function editable(s, c, expectedRevision, next) {
		if (c.form !== "project" && c.form !== "message") return invalid();
		revision.parse(expectedRevision);
		pending(s, c, (p) => {
			if (p) throw new WorkbenchLocalError("COMMAND_PENDING");
			s.get(s.drafts, contextKey(c), (raw) => {
				const d = draft(raw, c);
				if (!d || d.revision !== expectedRevision) throw new WorkbenchLocalError("LOCAL_CONFLICT");
				if (d.closedKey) throw new WorkbenchLocalError("COMMAND_CLOSED");
				if (d.pendingKey) return invalid();
				next(d);
			});
		});
	}
	function withSelection(d, keys) {
		return draftRecord.parse({
			...d,
			revision: d.revision + 1,
			uploadKeys: keys,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	async function checkedUpload(value) {
		try {
			return await verifyUploadBytes(value);
		} catch {
			return invalid();
		}
	}
	async function addUpload(input, expectedRevision, file) {
		const c = context(input);
		if (c.form !== "project" && c.form !== "message") return invalid();
		const value = await prepareUpload(principalId, file);
		return transaction("readwrite", (s, done) => editable(s, c, expectedRevision, (d) => {
			if ((d.uploadKeys?.length ?? 0) >= 3) throw new WorkbenchLocalError("UPLOAD_LIMIT");
			s.all(s.uploads.index("principalId"), principalId, (raw) => {
				const rows = raw.map(upload);
				if (rows.length >= uploadLimits.records || rows.filter((v) => v.bytes !== null).length >= uploadLimits.residentFiles) throw new WorkbenchLocalError("UPLOAD_LIMIT");
				const updated = withSelection(d, [...d.uploadKeys ?? [], value.key]);
				s.uploads.add(value);
				s.drafts.put(updated);
				done({
					draft: updated,
					upload: value
				});
			});
		}));
	}
	async function getUpload(key) {
		uuid().parse(key);
		const value = await transaction("readonly", (s, done) => s.get(s.uploads, key, (raw) => {
			if (raw === void 0) {
				done(null);
				return;
			}
			const v = uploadRecord.parse(raw);
			done(v.principalId === principalId ? upload(v) : null);
		}));
		return value ? checkedUpload(value) : null;
	}
	async function listUploads() {
		const rows = await transaction("readonly", (s, done) => s.all(s.uploads.index("principalId"), principalId, (raw) => {
			if (raw.length > uploadLimits.records) return invalid();
			done(raw.map(upload));
		}));
		return Promise.all(rows.map(checkedUpload));
	}
	async function loadUploads(input) {
		const c = context(input);
		return Promise.all((await transaction("readonly", (s, done) => s.get(s.drafts, contextKey(c), (raw) => {
			const d = draft(raw, c);
			if (!d) {
				done([]);
				return;
			}
			selected(s, d, done);
		}))).map(checkedUpload));
	}
	function changeUploadSelection(input, expectedRevision, key, select) {
		const c = context(input);
		uuid().parse(key);
		return transaction("readwrite", (s, done) => editable(s, c, expectedRevision, (d) => s.get(s.uploads, key, (raw) => {
			const v = upload(raw), keys = d.uploadKeys ?? [], included = keys.includes(key);
			if (select && (included || keys.length >= 3)) throw new WorkbenchLocalError("UPLOAD_LIMIT");
			if (!select && !included) throw new WorkbenchLocalError("LOCAL_CONFLICT");
			if (select && (v.bytes === null && v.receipt?.status !== "SUCCEEDED" || v.attachment?.state === "REMOVED" || v.receipt?.status === "FAILED")) throw new WorkbenchLocalError("UPLOAD_NOT_READY");
			const updated = withSelection(d, select ? [...keys, key] : keys.filter((k) => k !== key));
			s.drafts.put(updated);
			done(updated);
		})));
	}
	function selectUpload(input, expectedRevision, key) {
		return changeUploadSelection(input, expectedRevision, key, true);
	}
	function unlinkUpload(input, expectedRevision, key) {
		return changeUploadSelection(input, expectedRevision, key, false);
	}
	function observeUpload(key, input) {
		uuid().parse(key);
		const response = uploadResponse.safeParse(input), receipt = response.success ? inputOperation.parse({
			operationId: response.data.operationId,
			status: "SUCCEEDED",
			result: { attachmentId: response.data.attachment.attachmentId }
		}) : inputOperation.parse(input);
		return transaction("readwrite", (s, done) => s.get(s.uploads, key, (raw) => {
			const old = upload(raw);
			if (response.success && (response.data.attachment.state !== "READY" || response.data.attachment.clientAttachmentId !== old.envelope.metadata.clientAttachmentId || response.data.attachment.name !== old.envelope.metadata.name || response.data.attachment.byteSize !== old.envelope.byteSize)) return invalid();
			if (old.receipt && (old.receipt.operationId !== receipt.operationId || ["SUCCEEDED", "FAILED"].includes(old.receipt.status) && stable(old.receipt) !== stable(receipt))) return invalid();
			if (stable(old.receipt) === stable(receipt)) {
				done(old);
				return;
			}
			const value = upload({
				...old,
				receipt,
				observedAt: (/* @__PURE__ */ new Date()).toISOString(),
				revision: old.revision + 1
			});
			s.uploads.put(value);
			done(value);
		}));
	}
	function verifyUpload(key, expectedRevision, input) {
		uuid().parse(key);
		revision.parse(expectedRevision);
		const value = attachmentView.parse(input);
		return transaction("readwrite", (s, done) => s.get(s.uploads, key, (raw) => {
			const old = upload(raw);
			if (old.revision !== expectedRevision) throw new WorkbenchLocalError("LOCAL_CONFLICT");
			if (old.receipt?.status !== "SUCCEEDED") throw new WorkbenchLocalError("UPLOAD_NOT_READY");
			if (old.attachment && (old.attachment.createdAt !== value.createdAt || old.attachment.state === "REMOVED" && value.state !== "REMOVED")) return invalid();
			const updated = upload({
				...old,
				attachment: value,
				verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
				revision: old.revision + 1
			});
			s.uploads.put(updated);
			done(updated);
		}));
	}
	async function releaseUpload(key, expectedRevision) {
		const snapshot = await getUpload(key);
		if (!snapshot) return invalid();
		revision.parse(expectedRevision);
		return transaction("readwrite", (s, done) => s.get(s.uploads, key, (raw) => {
			const old = upload(raw);
			if (old.revision !== expectedRevision || !sameUpload(old, snapshot)) throw new WorkbenchLocalError("LOCAL_CONFLICT");
			if (old.receipt?.status !== "SUCCEEDED" && old.receipt?.status !== "FAILED") throw new WorkbenchLocalError("UPLOAD_NOT_READY");
			if (old.bytes === null) {
				done(old);
				return;
			}
			const value = upload({
				...old,
				bytes: null,
				releasedAt: (/* @__PURE__ */ new Date()).toISOString(),
				revision: old.revision + 1
			});
			s.uploads.put(value);
			done(value);
		}));
	}
	return {
		load,
		getPending,
		references,
		save,
		enqueue,
		getCommand,
		observe,
		closeStale,
		closeRemoved,
		startBlankInput,
		closedHistory,
		addUpload,
		getUpload,
		listUploads,
		loadUploads,
		selectUpload,
		unlinkUpload,
		observeUpload,
		verifyUpload,
		releaseUpload,
		close
	};
}
//#endregion
export { WorkbenchLocalError, draftContext, openWorkbenchLocal, removedOriginalProof, staleOriginalProof };

//# sourceMappingURL=local.js.map