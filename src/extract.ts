import ts from 'typescript';
import type { FunctionInfo, ParamInfo, PropShape, Shape, SkippedSignature, ValueKind } from './types';

export interface Extraction {
  readonly functions: FunctionInfo[];
  readonly skipped: SkippedSignature[];
}

const MAX_OBJECT_DEPTH = 2;
const MAX_OBJECT_PROPS = 16;

type Converted = { ok: true; shape: Shape; nullable: boolean } | { ok: false; reason: string };

/** Turns a package name into a JavaScript identifier: `query-string` becomes `queryString`. */
export function packageIdentifier(name: string): string {
  const base = name.replace(/^@[^/]+\//, '');
  const id = base.replace(/[^A-Za-z0-9_$]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''));
  return /^[A-Za-z_$]/.test(id) ? id : `_${id}`;
}

/**
 * Reads a declaration file with the TypeScript compiler API and returns every
 * exported function (and every function valued property of an exported
 * object) whose parameters breakhound can generate values for.
 */
export function extractSignatures(typesFile: string, packageName = 'pkg'): Extraction {
  const program = ts.createProgram([typesFile], {
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
    allowJs: false,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(typesFile);
  const functions: FunctionInfo[] = [];
  const skipped: SkippedSignature[] = [];
  if (!source) return { functions, skipped: [{ id: packageName, reason: `could not read ${typesFile}` }] };

  const pkgId = packageIdentifier(packageName);
  const seen = new Set<string>();

  const moduleSymbol = findModuleSymbol(checker, source);
  if (!moduleSymbol) {
    return { functions, skipped: [{ id: pkgId, reason: 'the declaration file has no exports' }] };
  }

  const idFor = (path: readonly string[]): string => {
    if (path.length === 0) return pkgId;
    if (path[0] === 'default') return path.length === 1 ? pkgId : [pkgId, ...path.slice(1)].join('.');
    return path.join('.');
  };

  const typeOf = (symbol: ts.Symbol): ts.Type => {
    const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
    return decl ? checker.getTypeOfSymbolAtLocation(symbol, decl) : checker.getTypeOfSymbol(symbol);
  };

  function addFunction(path: readonly string[], type: ts.Type): void {
    const id = idFor(path);
    if (seen.has(id)) return;
    seen.add(id);
    const name = path.length === 0 || (path.length === 1 && path[0] === 'default') ? pkgId : (path[path.length - 1] as string);
    const signatures = type.getCallSignatures();
    let firstReason = '';
    for (const signature of signatures) {
      const result = convertSignature(checker, signature, name);
      if (result.ok) {
        functions.push({ ...result.info, id, path: [...path], name });
        return;
      }
      firstReason ||= result.reason;
    }
    const first = signatures[0];
    skipped.push({
      id,
      reason: firstReason || 'no call signature',
      ...(first ? { signature: `${name}${checker.signatureToString(first)}` } : {}),
    });
  }

  function visitMembers(path: readonly string[], type: ts.Type): void {
    for (const prop of checker.getPropertiesOfType(type)) {
      const name = prop.getName();
      if (name === 'prototype' || name === 'constructor' || name.startsWith('__')) continue;
      const propType = typeOf(prop);
      const childPath = [...path, name];
      if (name.startsWith('_')) {
        if (propType.getCallSignatures().length) skipped.push({ id: idFor(childPath), reason: 'private by convention (leading underscore)' });
        continue;
      }
      if (propType.getCallSignatures().length) addFunction(childPath, propType);
      else if (propType.getConstructSignatures().length) skipped.push({ id: idFor(childPath), reason: 'class (constructors are not called)' });
    }
  }

  function visitExport(path: readonly string[], symbol: ts.Symbol, withMembers: boolean): void {
    const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    if (!(resolved.flags & ts.SymbolFlags.Value)) return;
    if (resolved.flags & ts.SymbolFlags.Class) {
      skipped.push({ id: idFor(path), reason: 'class (constructors are not called)' });
      return;
    }
    const type = typeOf(resolved);
    const callable = type.getCallSignatures().length > 0;
    if (callable) addFunction(path, type);
    else if (type.getConstructSignatures().length) {
      skipped.push({ id: idFor(path), reason: 'class (constructors are not called)' });
      return;
    }
    if (!callable || withMembers) {
      if (type.flags & ts.TypeFlags.Object) visitMembers(path, type);
    }
  }

  const exportEquals = moduleSymbol.exports?.get(ts.InternalSymbolName.ExportEquals);
  if (exportEquals) {
    visitExport([], exportEquals, true);
  } else {
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const name = symbol.getName();
      visitExport([name], symbol, name === 'default');
    }
  }

  functions.sort((a, b) => a.id.localeCompare(b.id));
  skipped.sort((a, b) => a.id.localeCompare(b.id));
  return { functions, skipped };
}

function findModuleSymbol(checker: ts.TypeChecker, source: ts.SourceFile): ts.Symbol | undefined {
  const direct = checker.getSymbolAtLocation(source);
  if (direct) return direct;
  // Script style declarations: `declare module 'name' { ... }`.
  for (const statement of source.statements) {
    if (ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name)) {
      const symbol = checker.getSymbolAtLocation(statement.name);
      if (symbol) return symbol;
    }
  }
  return undefined;
}

type SignatureResult =
  | { ok: true; info: Omit<FunctionInfo, 'id' | 'path' | 'name'> }
  | { ok: false; reason: string };

function convertSignature(checker: ts.TypeChecker, signature: ts.Signature, name: string): SignatureResult {
  const params: ParamInfo[] = [];
  for (const param of signature.getParameters()) {
    const decl = param.valueDeclaration;
    const paramDecl = decl && ts.isParameter(decl) ? decl : undefined;
    const rest = Boolean(paramDecl?.dotDotDotToken);
    const type = decl ? checker.getTypeOfSymbolAtLocation(param, decl) : checker.getTypeOfSymbol(param);
    const typeText = checker.typeToString(type);
    const declaredOptional = paramDecl ? checker.isOptionalParameter(paramDecl) : false;
    if (rest) {
      params.push({ name: param.getName(), shape: null, optional: true, rest: true, typeText });
      continue;
    }
    const converted = toShape(checker, type, 0);
    const optional = declaredOptional || (converted.ok && converted.nullable && isUndefinedAccepted(type));
    if (!converted.ok) {
      if (optional) {
        params.push({ name: param.getName(), shape: null, optional: true, rest: false, typeText });
        continue;
      }
      return { ok: false, reason: `parameter '${param.getName()}' has unsupported type ${typeText} (${converted.reason})` };
    }
    params.push({ name: param.getName(), shape: converted.shape, optional, rest: false, typeText });
  }
  let returnType = signature.getReturnType();
  let isAsync = false;
  const awaited = checker.getAwaitedType(returnType);
  if (awaited && awaited !== returnType) {
    isAsync = true;
    returnType = awaited;
  }
  return {
    ok: true,
    info: {
      params,
      returnType: checker.typeToString(signature.getReturnType()),
      returnKinds: valueKinds(checker, returnType),
      async: isAsync,
      signature: `${name}${checker.signatureToString(signature)}`,
    },
  };
}

function isUndefinedAccepted(type: ts.Type): boolean {
  if (type.flags & ts.TypeFlags.Undefined) return true;
  return type.isUnion() && type.types.some((t) => (t.flags & ts.TypeFlags.Undefined) !== 0);
}

function isDateType(type: ts.Type): boolean {
  const symbol = type.getSymbol();
  return Boolean(symbol && symbol.getName() === 'Date' && symbol.declarations?.some((d) => d.getSourceFile().hasNoDefaultLib));
}

function isEmptyObjectType(checker: ts.TypeChecker, type: ts.Type): boolean {
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    checker.getPropertiesOfType(type).length === 0 &&
    type.getCallSignatures().length === 0 &&
    type.getConstructSignatures().length === 0 &&
    checker.getIndexInfosOfType(type).length === 0
  );
}

/** Converts a TypeScript type to a Shape, or explains why it is not supported. */
export function toShape(checker: ts.TypeChecker, type: ts.Type, depth: number): Converted {
  const flags = type.flags;
  const text = () => checker.typeToString(type);
  if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return { ok: false, reason: 'any or unknown' };
  if (flags & (ts.TypeFlags.Never | ts.TypeFlags.Void)) return { ok: false, reason: text() };
  if (flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) return { ok: false, reason: 'null or undefined only' };
  if (type.isStringLiteral()) return ok({ kind: 'literal', values: [type.value] });
  if (type.isNumberLiteral()) return ok({ kind: 'literal', values: [type.value] });
  if (flags & ts.TypeFlags.BooleanLiteral) return ok({ kind: 'literal', values: [text() === 'true'] });
  if (flags & ts.TypeFlags.String) return ok({ kind: 'string' });
  if (flags & ts.TypeFlags.Number) return ok({ kind: 'number' });
  if (flags & ts.TypeFlags.BigInt) return ok({ kind: 'bigint' });
  if (flags & ts.TypeFlags.Boolean) return ok({ kind: 'boolean' });
  if (flags & ts.TypeFlags.TemplateLiteral) return { ok: false, reason: 'template literal type' };

  if (type.isUnion()) {
    let nullable = false;
    const options: Shape[] = [];
    const literals: (string | number | boolean)[] = [];
    let lastReason = '';
    for (const member of type.types) {
      if (member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) {
        nullable = true;
        continue;
      }
      const converted = toShape(checker, member, depth);
      if (!converted.ok) {
        lastReason = converted.reason;
        continue;
      }
      if (converted.shape.kind === 'literal') literals.push(...converted.shape.values);
      else options.push(converted.shape);
    }
    // true | false is how TypeScript represents boolean.
    if (literals.includes(true) && literals.includes(false) && !options.some((o) => o.kind === 'boolean')) {
      options.push({ kind: 'boolean' });
    }
    const rest = literals.filter((v) => typeof v !== 'boolean' || !options.some((o) => o.kind === 'boolean'));
    if (rest.length) options.unshift({ kind: 'literal', values: rest });
    if (options.length === 0) return { ok: false, reason: lastReason || text() };
    const shape: Shape = options.length === 1 ? (options[0] as Shape) : { kind: 'union', options };
    return { ok: true, shape, nullable };
  }

  if (type.isIntersection()) {
    const members = type.types.filter((t) => !isEmptyObjectType(checker, t));
    if (members.length === 1) return toShape(checker, members[0] as ts.Type, depth);
    return { ok: false, reason: `intersection ${text()}` };
  }

  if (flags & ts.TypeFlags.TypeParameter) {
    const constraint = checker.getBaseConstraintOfType(type);
    if (constraint && constraint !== type && !(constraint.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any))) {
      return toShape(checker, constraint, depth);
    }
    return { ok: false, reason: `generic type ${text()} without a supported constraint` };
  }

  if (flags & ts.TypeFlags.Object) {
    if (isDateType(type)) return ok({ kind: 'date' });
    if (checker.isTupleType(type)) return { ok: false, reason: `tuple ${text()}` };
    if (checker.isArrayType(type)) {
      const element = checker.getTypeArguments(type as ts.TypeReference)[0];
      if (!element) return { ok: false, reason: text() };
      if (depth >= MAX_OBJECT_DEPTH) return { ok: false, reason: `nested too deeply: ${text()}` };
      const converted = toShape(checker, element, depth + 1);
      if (!converted.ok) return { ok: false, reason: `array of ${converted.reason}` };
      return ok({ kind: 'array', element: converted.shape });
    }
    if (type.getCallSignatures().length || type.getConstructSignatures().length) {
      return { ok: false, reason: `function ${text()}` };
    }
    const symbol = type.getSymbol();
    if (symbol && symbol.flags & ts.SymbolFlags.Class) return { ok: false, reason: `class instance ${text()}` };
    if (checker.getIndexInfosOfType(type).length) return { ok: false, reason: `index signature in ${text()}` };
    const props = checker.getPropertiesOfType(type);
    if (props.length === 0) return { ok: false, reason: `empty object type ${text()}` };
    if (props.length > MAX_OBJECT_PROPS) return { ok: false, reason: `object with ${props.length} properties ${text()}` };
    if (depth >= MAX_OBJECT_DEPTH) return { ok: false, reason: `nested too deeply: ${text()}` };
    const shapes: PropShape[] = [];
    for (const prop of props) {
      const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
      const propType = checker.getTypeOfSymbol(prop);
      const converted = prop.flags & ts.SymbolFlags.Method ? null : toShape(checker, propType, depth + 1);
      if (!converted || !converted.ok) {
        if (optional) continue;
        return { ok: false, reason: `property '${prop.getName()}' of ${text()} is not supported` };
      }
      shapes.push({ name: prop.getName(), shape: converted.shape, optional: optional || converted.nullable });
    }
    if (!shapes.some((p) => !p.optional) && shapes.length === 0) return { ok: false, reason: text() };
    return ok({ kind: 'object', props: shapes });
  }
  return { ok: false, reason: text() };
}

function ok(shape: Shape): Converted {
  return { ok: true, shape, nullable: false };
}

function valueKinds(checker: ts.TypeChecker, type: ts.Type): ValueKind[] {
  const kinds = new Set<ValueKind>();
  const visit = (t: ts.Type): void => {
    const f = t.flags;
    if (t.isUnion()) {
      t.types.forEach(visit);
      return;
    }
    if (f & (ts.TypeFlags.StringLike)) kinds.add('string');
    else if (f & ts.TypeFlags.NumberLike) kinds.add('number');
    else if (f & ts.TypeFlags.BooleanLike) kinds.add('boolean');
    else if (f & ts.TypeFlags.BigIntLike) kinds.add('bigint');
    else if (f & (ts.TypeFlags.Void | ts.TypeFlags.Undefined)) kinds.add('void');
    else if (f & ts.TypeFlags.Object) {
      if (isDateType(t)) kinds.add('date');
      else if (checker.isArrayType(t) || checker.isTupleType(t)) kinds.add('array');
      else kinds.add('object');
    } else kinds.add('other');
  };
  visit(type);
  return [...kinds].sort();
}
