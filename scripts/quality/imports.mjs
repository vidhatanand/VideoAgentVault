import ts from 'typescript';
/** Conservative check: a binding is unused only when its sole identifier is its import. */
export function unusedImports(source,filename='module.js'){
 const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true);
 const counts=new Map(),bindings=[];
 function visit(node){
  if(ts.isIdentifier(node))counts.set(node.text,(counts.get(node.text)||0)+1);
  if(ts.isImportDeclaration(node)&&node.importClause){
   const clause=node.importClause;if(clause.name)bindings.push(clause.name.text);
   if(clause.namedBindings){
    if(ts.isNamespaceImport(clause.namedBindings))bindings.push(clause.namedBindings.name.text);
    else for(const item of clause.namedBindings.elements)bindings.push(item.name.text);
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);return bindings.filter(name=>counts.get(name)===1);
}
