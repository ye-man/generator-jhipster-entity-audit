const glob = require('glob');

const columnTemplate = '<column name=\'created_by\' type=\'varchar(50)\'>\n' +
  '                <constraints nullable=\'false\'/>\n' +
  '            </column>\n' +
  // eslint-disable-next-line no-template-curly-in-string
  '            <column name=\'created_date\' type=\'timestamp\' defaultValueDate=\'${now}\'>\n' +
  '                <constraints nullable=\'false\'/>\n' +
  '            </column>\n' +
  '            <column name=\'last_modified_by\' type=\'varchar(50)\'/>\n' +
  '            <column name=\'last_modified_date\' type=\'timestamp\'/>';

const updateEntityAudit = function (entityName, entityData, javaDir, resourceDir, updateIndex) {
  if (this.auditFramework === 'custom') {
    // extend entity with AbstractAuditingEntity
    if (!this.fs.read(`${javaDir}domain/${entityName}.java`, {
      defaults: ''
    }).includes('extends AbstractAuditingEntity')) {
      this.replaceContent(`${javaDir}domain/${entityName}.java`, `public class ${entityName}`, `public class ${entityName} extends AbstractAuditingEntity`);
    }
    // extend DTO with AbstractAuditingDTO
    if (entityData.dto === 'mapstruct') {
      if (!this.fs.read(`${javaDir}service/dto/${entityName}DTO.java`, {
        defaults: ''
      }).includes('extends AbstractAuditingDTO')) {
        this.replaceContent(`${javaDir}service/dto/${entityName}DTO.java`, `public class ${entityName}DTO`, `public class ${entityName}DTO extends AbstractAuditingDTO`);
      }
    }

    // update liquibase changeset
    const file = glob.sync(`${resourceDir}/config/liquibase/changelog/*_added_entity_${entityName}.xml`)[0];
    this.addColumnToLiquibaseEntityChangeset(file, columnTemplate);
  } else if (this.auditFramework === 'javers') {
    // check if repositories are already annotated
    const auditTableAnnotation = '@JaversSpringDataAuditable';
    const pattern = new RegExp(auditTableAnnotation, 'g');
    const content = this.fs.read(`${javaDir}repository/${entityName}Repository.java`, 'utf8');

    if (!pattern.test(content)) {
      // add javers annotations to repository
      if (!this.fs.read(`${javaDir}repository/${entityName}Repository.java`, {
        defaults: ''
      }).includes('@JaversSpringDataAuditable')) {
        this.replaceContent(`${javaDir}repository/${entityName}Repository.java`, `public interface ${entityName}Repository`, `@JaversSpringDataAuditable\npublic interface ${entityName}Repository`);
        this.replaceContent(`${javaDir}repository/${entityName}Repository.java`, `domain.${entityName};`, `domain.${entityName};\nimport org.javers.spring.annotation.JaversSpringDataAuditable;`);
      }
      // update the list of audited entities if audit page is available
      if (updateIndex && this.fs.exists(`${javaDir}web/rest/JaversEntityAuditResource.java`)) {
        this.existingEntities.push(entityName);
        this.auditedEntities = [];

        this.existingEntities.forEach((entityName) => {
          this.auditedEntities.push(`'${entityName}'`);
        });

        const files = [{
          from: `${this.javaTemplateDir}/web/rest/_JaversEntityAuditResource.java`,
          to: `${javaDir}web/rest/JaversEntityAuditResource.java`
        }];
        this.copyFiles(files);
      }
    }
  }
};

module.exports = {
  columnTemplate,
  updateEntityAudit
};