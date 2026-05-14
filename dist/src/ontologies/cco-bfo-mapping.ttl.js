/**
 * Minimal CCO-to-BFO Mapping
 *
 * This provides essential subClassOf relationships between common CCO classes
 * and BFO classes for rooting validation in Iteration 2.
 *
 * In Iteration 3, this will be replaced with full CCO subset extraction.
 *
 * Source: Manually curated from CCO documentation
 * Created: 2026-01-08
 * License: BSD-3-Clause (CCO) + CC-BY 4.0 (BFO)
 */

export const CCO_BFO_MAPPING = `@prefix cco: <http://www.ontologyrepository.com/CommonCoreOntologies/>.
@prefix bfo: <http://purl.obolibrary.org/obo/>.
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.

# Common CCO Classes → BFO Hierarchy

# Agents and Persons
cco:Person rdfs:subClassOf bfo:BFO_0000040.  # material entity
cco:Agent rdfs:subClassOf bfo:BFO_0000040.  # material entity
cco:Organization rdfs:subClassOf bfo:BFO_0000040.  # material entity

# Built Environment
cco:House rdfs:subClassOf cco:Facility.
cco:Building rdfs:subClassOf cco:Facility.

# Roles
cco:Role rdfs:subClassOf bfo:BFO_0000023.  # role
cco:ResidentRole rdfs:subClassOf cco:Role.
cco:StudentRole rdfs:subClassOf cco:Role.
cco:EmployeeRole rdfs:subClassOf cco:Role.

# Information Content Entities
cco:InformationContentEntity rdfs:subClassOf bfo:BFO_0000031.  # generically dependent continuant
cco:DesignativeInformationContentEntity rdfs:subClassOf cco:InformationContentEntity.
cco:Name rdfs:subClassOf cco:DesignativeInformationContentEntity.
cco:PersonName rdfs:subClassOf cco:Name.
cco:Identifier rdfs:subClassOf cco:DesignativeInformationContentEntity.
cco:PostalAddress rdfs:subClassOf cco:DesignativeInformationContentEntity.

# Information Bearing Entities
cco:InformationBearingEntity rdfs:subClassOf bfo:BFO_0000030.  # object
cco:InformationBearingArtifact rdfs:subClassOf cco:InformationBearingEntity.
cco:Document rdfs:subClassOf cco:InformationBearingArtifact.
cco:Record rdfs:subClassOf cco:Document.
cco:PersonNameRecord rdfs:subClassOf cco:Record.
cco:PostalAddressRecord rdfs:subClassOf cco:Record.

# Artifacts
cco:Artifact rdfs:subClassOf bfo:BFO_0000030.  # object

# Processes and Acts
cco:Act rdfs:subClassOf bfo:BFO_0000015.  # process
cco:IntentionalAct rdfs:subClassOf cco:Act.
cco:ActOfOccupancy rdfs:subClassOf cco:IntentionalAct.

# Qualities
cco:Quality rdfs:subClassOf bfo:BFO_0000019.  # quality

# Sites and Facilities
cco:Site rdfs:subClassOf bfo:BFO_0000029.  # site
cco:Facility rdfs:subClassOf cco:Site.
cco:GeographicRegion rdfs:subClassOf bfo:BFO_0000029.  # site

# Dispositions and Functions
cco:Function rdfs:subClassOf bfo:BFO_0000034.  # function
cco:Disposition rdfs:subClassOf bfo:BFO_0000016.  # disposition

# Groups and Social Entities (EXPERT REVIEW 2026-01-13)
# Updated per expert: BFO_0000027 (Object Aggregate) is more specific than BFO_0000040 (Material Entity)
# Rationale: An Agent is typically an Object, so a group of them is an Object Aggregate
cco:GroupOfAgents rdfs:subClassOf bfo:BFO_0000027.  # object aggregate

# Directive Information (EXPERT REVIEW 2026-01-13)
cco:DirectiveInformationContentEntity rdfs:subClassOf cco:InformationContentEntity.

# Temporal Regions (commonly referenced)
cco:TemporalInterval rdfs:subClassOf bfo:BFO_0000038.  # one-dimensional temporal region

# Generic subclasses for common patterns
# (Add more as needed for test fixtures)
`;

/**
 * Helper to check if an IRI is a CCO class
 */
export function isCCOClass(iri) {
  return iri.includes('CommonCoreOntologies');
}

/**
 * List of CCO classes we support (for validation)
 * EXPERT REVIEW (2026-01-13): Added GeographicRegion, GroupOfAgents, DirectiveInformationContentEntity
 */
export const SUPPORTED_CCO_CLASSES = [
  'Person',
  'Agent',
  'Organization',
  'Role',
  'ResidentRole',
  'StudentRole',
  'EmployeeRole',
  'InformationContentEntity',
  'DesignativeInformationContentEntity',
  'DirectiveInformationContentEntity', // EXPERT REVIEW 2026-01-13
  'Name',
  'PersonName',
  'Identifier',
  'InformationBearingEntity',
  'InformationBearingArtifact',
  'Document',
  'Record',
  'PersonNameRecord',
  'PostalAddressRecord',
  'PostalAddress',
  'Artifact',
  'Act',
  'IntentionalAct',
  'ActOfOccupancy',
  'Quality',
  'Site',
  'Facility',
  'House',
  'Building',
  'GeographicRegion', // EXPERT REVIEW 2026-01-13
  'GroupOfAgents', // EXPERT REVIEW 2026-01-13
  'Function',
  'Disposition',
  'TemporalInterval',
  'QualityMeasurement',
  'MeasurementUnit',
];
