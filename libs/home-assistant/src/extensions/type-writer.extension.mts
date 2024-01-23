import { TServiceParams } from "@zcc/boilerplate";
import { is } from "@zcc/utilities";
import { dump } from "js-yaml";
import {
  addSyntheticLeadingComment,
  createPrinter,
  createSourceFile,
  EmitHint,
  factory,
  NewLineKind,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  TypeNode,
} from "typescript";

import {
  ServiceListFieldDescription,
  ServiceListServiceTarget,
} from "../helpers/types/fetch/service-list.mjs";
import { LIB_HOME_ASSISTANT } from "../home-assistant.module.mjs";

const printer = createPrinter({ newLine: NewLineKind.LineFeed });
const resultFile = createSourceFile(
  "",
  "",
  ScriptTarget.Latest,
  false,
  ScriptKind.TS,
);
let lastBuild: string;
let lastServices: string;

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function TypeWriter({
  getApis,
  logger,
}: TServiceParams): Promise<string> {
  const hass = getApis(LIB_HOME_ASSISTANT);

  const domains = await hass.fetch.listServices();
  const stringified = JSON.stringify(domains);
  if (stringified === lastServices) {
    return lastBuild;
  }
  // logger.info(`Services updated`);
  lastServices = stringified;
  lastBuild = printer.printNode(
    EmitHint.Unspecified,
    // Wrap all this into a top level `interface iCallService`
    factory.createTypeAliasDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      factory.createIdentifier("iCallService"),
      undefined,
      // Create categories based off domain name
      // { domain: {...services} }
      factory.createTypeLiteralNode(
        domains.map(({ domain, services }) =>
          factory.createPropertySignature(
            undefined,
            factory.createIdentifier(domain),
            undefined,
            factory.createTypeLiteralNode(
              // Create functions based on provided services
              // { [...service_name](service_data): Promise<void> }
              Object.entries(services).map(([key, value]) =>
                addSyntheticLeadingComment(
                  factory.createMethodSignature(
                    undefined,
                    factory.createIdentifier(key),
                    undefined,
                    undefined,
                    [
                      // f( service_data: { ...definition } )
                      //    Provide this        ^^^^^^
                      factory.createParameterDeclaration(
                        undefined,
                        undefined,
                        factory.createIdentifier("service_data"),
                        undefined,
                        factory.createTypeLiteralNode(
                          [
                            ...Object.entries(value.fields).map(
                              ([service, details]) =>
                                fieldPropertySignature(
                                  service,
                                  details,
                                  domain,
                                  key,
                                ),
                            ),
                            createTarget(value.target),
                          ].filter(i => !is.undefined(i)),
                        ),
                      ),
                    ],
                    factory.createTypeReferenceNode(
                      factory.createIdentifier("Promise"),
                      [factory.createKeywordTypeNode(SyntaxKind.VoidKeyword)],
                    ),
                  ),
                  SyntaxKind.MultiLineCommentTrivia,
                  `*\n` +
                    [`## ${value.name || key}`, "", value.description]
                      .map(i => ` * ${i}`)
                      .join(`\n`),
                  true,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    resultFile,
  );

  function createTarget(target: ServiceListServiceTarget) {
    if (is.empty(target)) {
      return undefined;
    }
    if (target.entity) {
      const property = factory.createPropertySignature(
        undefined,
        factory.createIdentifier("entity_id"),
        undefined,
        factory.createUnionTypeNode([
          ...(is.empty(target.entity.domain)
            ? [
                factory.createUnionTypeNode([
                  factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
                  factory.createArrayTypeNode(
                    factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
                  ),
                ]),
              ]
            : [
                // Currently using a very loose definition
                // Array<string | PICK_ENTITY<"domain">> | string | PICK_ENTITY<"domain">
                factory.createTypeReferenceNode(
                  factory.createIdentifier("PICK_ENTITY"),
                  [
                    factory.createLiteralTypeNode(
                      factory.createStringLiteral(target.entity.domain),
                    ),
                  ],
                ),
                factory.createArrayTypeNode(
                  factory.createTypeReferenceNode(
                    factory.createIdentifier("PICK_ENTITY"),
                    [
                      factory.createLiteralTypeNode(
                        factory.createStringLiteral(target.entity.domain),
                      ),
                    ],
                  ),
                ),
              ]),
        ]),
      );
      return addSyntheticLeadingComment(
        property,
        SyntaxKind.MultiLineCommentTrivia,
        "Assisted definition",
        true,
      );
    }
    if (target.integration) {
      return undefined;
    }
    if (target.device) {
      return undefined;
    }
    logger.error(
      { target },
      `this#createTarget doesn't know what to do with target. Report as bug with this log line`,
    );
    return undefined;
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  function fieldPropertySignature(
    parameterName: string,
    { selector, ...details }: ServiceListFieldDescription,
    serviceDomain: string,
    serviceName: string,
  ) {
    let node: TypeNode;
    const { domain } = selector?.entity ?? {};
    // : boolean
    if (!is.undefined(selector?.boolean))
      node = factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
    // : number
    else if (!is.undefined(selector?.number))
      node = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
    // : string
    else if (!is.undefined(selector?.text) || !is.undefined(selector?.time))
      node = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
    // string | `domain.${keyof typeof ENTITY_SETUP.domain}`
    else if (!is.undefined(selector?.entity))
      node = is.empty(domain)
        ? factory.createKeywordTypeNode(SyntaxKind.StringKeyword)
        : factory.createUnionTypeNode([
            factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
            factory.createArrayTypeNode(
              factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
            ),
            factory.createArrayTypeNode(
              factory.createTemplateLiteralType(
                factory.createTemplateHead(`${domain}.`, `${domain}.`),
                [
                  factory.createTemplateLiteralTypeSpan(
                    factory.createTypeOperatorNode(
                      SyntaxKind.KeyOfKeyword,
                      factory.createTypeQueryNode(
                        factory.createQualifiedName(
                          factory.createIdentifier("ENTITY_SETUP"),
                          factory.createIdentifier(domain),
                        ),
                      ),
                    ),
                    factory.createTemplateTail("", ""),
                  ),
                ],
              ),
            ),
          ]);
    // : "option" | "option" | "option" | "option"
    else if (!is.undefined(selector?.select))
      node = factory.createUnionTypeNode(
        selector?.select.options.map(
          (i: string | Record<"label" | "value", string>) =>
            factory.createLiteralTypeNode(
              factory.createStringLiteral(is.string(i) ? i : i.value),
            ),
        ),
      );
    // : Record<string, unknown> | (unknown[]);
    else if (is.undefined(selector?.object)) {
      node = factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
    }
    // else if (!is.undefined(selector?.))
    // : unknown
    else {
      node = factory.createUnionTypeNode([
        serviceDomain === "scene" && serviceName === "apply"
          ? factory.createTypeReferenceNode(
              factory.createIdentifier("Partial"),
              [
                factory.createTypeReferenceNode(
                  factory.createIdentifier("Record"),
                  [
                    factory.createTypeReferenceNode(
                      factory.createIdentifier("PICK_ENTITY"),
                      undefined,
                    ),
                    factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
                  ],
                ),
              ],
            )
          : factory.createTypeReferenceNode(
              factory.createIdentifier("Record"),
              [
                factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
                factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
              ],
            ),
        factory.createParenthesizedType(
          factory.createArrayTypeNode(
            factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
          ),
        ),
      ]);
    }

    const property = factory.createPropertySignature(
      undefined,
      factory.createIdentifier(parameterName),
      details.required
        ? undefined
        : factory.createToken(SyntaxKind.QuestionToken),
      node,
    );
    const example = String(details.example);
    return addSyntheticLeadingComment(
      property,
      SyntaxKind.MultiLineCommentTrivia,
      `*\n` +
        [
          "## " + (is.empty(details.name) ? parameterName : details.name),
          ...(is.empty(details.description) ? [] : ["", details.description]),
          ...(is.empty(example) ? [] : ["", `@example ${example}`]),
          ...(is.undefined(details.default)
            ? []
            : ["", `@default ${JSON.stringify(details.default)}`]),
          "",
          "## Selector",
          "",
          "```yaml",
          dump(selector),
          "```",
        ]
          .map(i => ` * ${i}`)
          .join(`\n`),
      true,
    );
  }

  return lastBuild;
}
