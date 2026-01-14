import { describe, test, assert, beforeEach } from '../../test-utils.js';
import { mermaidLifter } from '../../../src/concepts/ontograde/mermaidLifter.js';

describe('Mermaid Lifter Concept', () => {

  beforeEach(() => {
    // Clear state
    mermaidLifter.state.rdfGraphs.clear();
    mermaidLifter.state.errors.clear();
  });

  test('should have default empty state', () => {
    assert.strictEqual(mermaidLifter.state.rdfGraphs.size, 0);
    assert.strictEqual(mermaidLifter.state.errors.size, 0);
  });

  test('expandIRI should expand known prefixes', () => {
    const expanded = mermaidLifter.helpers.expandIRI('cco:Person');
    assert.strictEqual(expanded, 'http://www.ontologyrepository.com/CommonCoreOntologies/Person');
  });

  test('expandIRI should expand bfo prefixes', () => {
    const expanded = mermaidLifter.helpers.expandIRI('bfo:Entity');
    assert.strictEqual(expanded, 'http://purl.obolibrary.org/obo/Entity');
  });

  test('expandIRI should return unknown prefixes as-is', () => {
    const expanded = mermaidLifter.helpers.expandIRI('unknown:Something');
    assert.strictEqual(expanded, 'unknown:Something');
  });

  test('liftToRDF should parse valid Mermaid with nodes', () => {
    const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["ResidentRole<br>IRI: cco:ResidentRole"]`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    assert.ok(store.size > 0, 'Store should contain triples');

    // Check that Person_0 exists with correct type
    const personQuads = store.getQuads(
      'http://example.org/Person_0',
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
    );
    assert.strictEqual(personQuads.length, 1, 'Person_0 should be typed as cco:Person');
  });

  test('liftToRDF should parse edges with explicit IRI correctly', () => {
    const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["ResidentRole<br>IRI: cco:ResidentRole"]
Person_0 -->|"is bearer of<br>IRI: cco:is_bearer_of"| Role_0`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    const bearerQuads = store.getQuads(
      'http://example.org/Person_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of',
      'http://example.org/Role_0'
    );
    assert.strictEqual(bearerQuads.length, 1, 'Should have is_bearer_of relationship');
  });

  test('liftToRDF should parse BFO predicate IRIs correctly', () => {
    const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Act_0["ActOfOccupancy<br>IRI: cco:ActOfOccupancy"]
Person_0 -->|"participates in<br>IRI: bfo:BFO_0000056"| Act_0`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    const participatesQuads = store.getQuads(
      'http://example.org/Person_0',
      'http://purl.obolibrary.org/obo/BFO_0000056',
      'http://example.org/Act_0'
    );
    assert.strictEqual(participatesQuads.length, 1, 'Should have BFO participates_in relationship');
  });

  test('liftToRDF should parse full URL predicate IRIs correctly', () => {
    const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Act_0["ActOfOccupancy<br>IRI: cco:ActOfOccupancy"]
Person_0 -->|"participates in<br>IRI: http://purl.obolibrary.org/obo/BFO_0000056"| Act_0`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    const participatesQuads = store.getQuads(
      'http://example.org/Person_0',
      'http://purl.obolibrary.org/obo/BFO_0000056',
      'http://example.org/Act_0'
    );
    assert.strictEqual(participatesQuads.length, 1, 'Should parse full URL predicate IRI');
  });

  test('liftToRDF should handle nodes without explicit IRI', () => {
    const mermaid = `graph TD
Person_0["Person"]`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    assert.ok(store.size > 0, 'Store should contain triples');

    // Should use default ex: namespace
    const personQuads = store.getQuads(
      'http://example.org/Person_0',
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      null
    );
    assert.strictEqual(personQuads.length, 1, 'Person_0 should have a type');
  });

  test('liftToRDF should add rdfs:label for nodes', () => {
    const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    const labelQuads = store.getQuads(
      'http://example.org/Person_0',
      'http://www.w3.org/2000/01/rdf-schema#label',
      null
    );
    assert.strictEqual(labelQuads.length, 1, 'Should have label');
    assert.strictEqual(labelQuads[0].object.value, 'Person', 'Label should be "Person"');
  });

  test('liftToRDF should throw error for empty diagram', () => {
    assert.throws(
      () => mermaidLifter.helpers.liftToRDF('graph TD\n'),
      /No valid nodes or edges/,
      'Should throw error for empty diagram'
    );
  });

  test('liftToRDF should throw error for completely empty input', () => {
    assert.throws(
      () => mermaidLifter.helpers.liftToRDF(''),
      /No valid nodes or edges/,
      'Should throw error for empty input'
    );
  });

  test('liftToRDF should handle graph direction variants', () => {
    const variants = ['graph TD', 'graph LR', 'graph TB', 'graph RL', 'graph BT'];

    for (const variant of variants) {
      const mermaid = `${variant}
Person_0["Person<br>IRI: cco:Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      assert.ok(store.size > 0, `Should parse ${variant} variant`);
    }
  });

  test('liftDiagram action should emit diagramLifted on success', () => {
    const received = [];
    mermaidLifter.subscribe((event, payload) => received.push({ event, payload }));

    const validMermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]`;

    mermaidLifter.actions.liftDiagram({
      diagramId: 'test-1',
      mermaidText: validMermaid,
    });

    const liftedEvent = received.find(r => r.event === 'diagramLifted');
    assert.ok(liftedEvent, 'Should emit diagramLifted event');
    assert.strictEqual(liftedEvent.payload.diagramId, 'test-1');
    assert.ok(liftedEvent.payload.rdfGraph, 'Payload should contain RDF graph');
  });

  test('liftDiagram action should emit liftingFailed on error', () => {
    const received = [];
    mermaidLifter.subscribe((event, payload) => received.push({ event, payload }));

    mermaidLifter.actions.liftDiagram({
      diagramId: 'test-2',
      mermaidText: 'graph TD\n', // Empty diagram
    });

    const failedEvent = received.find(r => r.event === 'liftingFailed');
    assert.ok(failedEvent, 'Should emit liftingFailed event');
    assert.strictEqual(failedEvent.payload.diagramId, 'test-2');
    assert.ok(failedEvent.payload.error, 'Payload should contain error');
    assert.strictEqual(failedEvent.payload.error.type, 'PARSE_ERROR');
  });

  test('liftDiagram should store RDF graph in state on success', () => {
    const validMermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]`;

    mermaidLifter.actions.liftDiagram({
      diagramId: 'test-3',
      mermaidText: validMermaid,
    });

    assert.ok(mermaidLifter.state.rdfGraphs.has('test-3'), 'Should store graph in state');
    assert.strictEqual(mermaidLifter.state.errors.has('test-3'), false, 'Should not have error');
  });

  test('liftDiagram should store error in state on failure', () => {
    mermaidLifter.actions.liftDiagram({
      diagramId: 'test-4',
      mermaidText: '',
    });

    assert.strictEqual(mermaidLifter.state.rdfGraphs.has('test-4'), false, 'Should not store graph');
    assert.ok(mermaidLifter.state.errors.has('test-4'), 'Should have error in state');

    const error = mermaidLifter.state.errors.get('test-4');
    assert.strictEqual(error.type, 'PARSE_ERROR');
    assert.ok(error.userMessage, 'Should have user-friendly message');
  });

  test('liftDiagram should emit largeGraphWarning for diagrams >100 nodes', () => {
    const received = [];
    mermaidLifter.subscribe((event, payload) => received.push({ event, payload }));

    // Create a diagram with >100 nodes
    let largeDiagram = 'graph TD\n';
    for (let i = 0; i < 101; i++) {
      largeDiagram += `Node_${i}["Node${i}<br>IRI: ex:Node${i}"]\n`;
    }

    mermaidLifter.actions.liftDiagram({
      diagramId: 'test-large',
      mermaidText: largeDiagram,
    });

    const warningEvent = received.find(r => r.event === 'largeGraphWarning');
    assert.ok(warningEvent, 'Should emit largeGraphWarning event');
    assert.strictEqual(warningEvent.payload.diagramId, 'test-large');
    assert.ok(warningEvent.payload.nodeCount > 100, 'Should report correct node count');
  });

  test('getUserFriendlyMessage should return appropriate messages', () => {
    const parseError = new Error('syntax error');
    const parseMsg = mermaidLifter.helpers.getUserFriendlyMessage('PARSE_ERROR', parseError);
    assert.ok(parseMsg.includes('Invalid Mermaid syntax'), 'Should return parse error message');

    const unknownError = new Error('something went wrong');
    const unknownMsg = mermaidLifter.helpers.getUserFriendlyMessage('UNKNOWN_ERROR', unknownError);
    assert.ok(unknownMsg.includes('unexpected error'), 'Should return generic error message');
  });

  test('liftToRDF should handle complex diagrams with multiple edges', () => {
    const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["ResidentRole<br>IRI: cco:ResidentRole"]
Process_0["ActOfOccupancy<br>IRI: cco:ActOfOccupancy"]
Person_0 -->|"is bearer of<br>IRI: cco:is_bearer_of"| Role_0
Process_0 -->|"realizes<br>IRI: cco:realizes"| Role_0`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    // Should have 3 nodes (each with type and label = 6 triples) + 2 edges = 8 triples
    assert.ok(store.size >= 8, 'Should have at least 8 triples');

    // Verify both edges exist
    const bearer = store.getQuads(
      'http://example.org/Person_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of',
      'http://example.org/Role_0'
    );
    assert.strictEqual(bearer.length, 1, 'Should have is_bearer_of edge');

    const realizes = store.getQuads(
      'http://example.org/Process_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/realizes',
      'http://example.org/Role_0'
    );
    assert.strictEqual(realizes.length, 1, 'Should have realizes edge');
  });

  test('liftToRDF should parse literal edges with explicit IRI', () => {
    const mermaid = `graph TD
TI_0["TemporalInterval<br>IRI: cco:TemporalInterval"]
TI_0 -->|"has start time<br>IRI: cco:has_start_time"| "2026-01-01T00:00:00"
TI_0 -->|"has end time<br>IRI: cco:has_end_time"| "2026-12-31T23:59:59"`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    // Check has_start_time literal
    const startTimeQuads = store.getQuads(
      'http://example.org/TI_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/has_start_time',
      null
    );
    assert.strictEqual(startTimeQuads.length, 1, 'Should have has_start_time relationship');
    assert.strictEqual(startTimeQuads[0].object.termType, 'Literal', 'Object should be a Literal');
    assert.strictEqual(startTimeQuads[0].object.value, '2026-01-01T00:00:00', 'Literal value should match');

    // Check has_end_time literal
    const endTimeQuads = store.getQuads(
      'http://example.org/TI_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/has_end_time',
      null
    );
    assert.strictEqual(endTimeQuads.length, 1, 'Should have has_end_time relationship');
    assert.strictEqual(endTimeQuads[0].object.termType, 'Literal', 'Object should be a Literal');
    assert.strictEqual(endTimeQuads[0].object.value, '2026-12-31T23:59:59', 'Literal value should match');
  });

  test('liftToRDF should add xsd:dateTime datatype for temporal predicates', () => {
    const mermaid = `graph TD
TI_0["TemporalInterval<br>IRI: cco:TemporalInterval"]
TI_0 -->|"has start time<br>IRI: cco:has_start_time"| "2026-01-01T00:00:00"`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    const startTimeQuads = store.getQuads(
      'http://example.org/TI_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/has_start_time',
      null
    );
    assert.strictEqual(startTimeQuads.length, 1, 'Should have has_start_time relationship');
    assert.strictEqual(
      startTimeQuads[0].object.datatype.value,
      'http://www.w3.org/2001/XMLSchema#dateTime',
      'Should have xsd:dateTime datatype'
    );
  });

  test('liftToRDF should add xsd:string datatype for has_text_value', () => {
    const mermaid = `graph TD
IBE_0["InformationBearingEntity<br>IRI: cco:InformationBearingEntity"]
IBE_0 -->|"has text value<br>IRI: cco:has_text_value"| "John Doe"`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    const textValueQuads = store.getQuads(
      'http://example.org/IBE_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/has_text_value',
      null
    );
    assert.strictEqual(textValueQuads.length, 1, 'Should have has_text_value relationship');
    assert.strictEqual(textValueQuads[0].object.value, 'John Doe', 'Literal value should match');
    assert.strictEqual(
      textValueQuads[0].object.datatype.value,
      'http://www.w3.org/2001/XMLSchema#string',
      'Should have xsd:string datatype'
    );
  });

  test('liftToRDF should add xsd:decimal datatype for has_measurement_value', () => {
    const mermaid = `graph TD
QM_0["QualityMeasurement<br>IRI: cco:QualityMeasurement"]
QM_0 -->|"has measurement value<br>IRI: cco:has_measurement_value"| "42.5"`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    const measurementQuads = store.getQuads(
      'http://example.org/QM_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/has_measurement_value',
      null
    );
    assert.strictEqual(measurementQuads.length, 1, 'Should have has_measurement_value relationship');
    assert.strictEqual(measurementQuads[0].object.value, '42.5', 'Literal value should match');
    assert.strictEqual(
      measurementQuads[0].object.datatype.value,
      'http://www.w3.org/2001/XMLSchema#decimal',
      'Should have xsd:decimal datatype'
    );
  });

  test('liftToRDF should handle mixed object and literal edges with explicit IRIs', () => {
    const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["ResidentRole<br>IRI: cco:ResidentRole"]
Act_0["ActOfOccupancy<br>IRI: cco:ActOfOccupancy"]
TI_0["TemporalInterval<br>IRI: cco:TemporalInterval"]
Person_0 -->|"is bearer of<br>IRI: cco:is_bearer_of"| Role_0
Act_0 -->|"realizes<br>IRI: cco:realizes"| Role_0
Act_0 -->|"occurs during<br>IRI: bfo:BFO_0000199"| TI_0
TI_0 -->|"has start time<br>IRI: cco:has_start_time"| "2026-01-01T00:00:00"
TI_0 -->|"has end time<br>IRI: cco:has_end_time"| "2026-12-31T23:59:59"`;

    const store = mermaidLifter.helpers.liftToRDF(mermaid);

    // Should have 4 nodes (type + label each = 8) + 3 object edges + 2 literal edges = 13 triples
    assert.ok(store.size >= 13, 'Should have at least 13 triples');

    // Verify CCO object edge
    const bearerEdge = store.getQuads(
      'http://example.org/Person_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of',
      'http://example.org/Role_0'
    );
    assert.strictEqual(bearerEdge.length, 1, 'Should have is_bearer_of edge');

    // Verify BFO object edge
    const occursDuringEdge = store.getQuads(
      'http://example.org/Act_0',
      'http://purl.obolibrary.org/obo/BFO_0000199',
      'http://example.org/TI_0'
    );
    assert.strictEqual(occursDuringEdge.length, 1, 'Should have BFO occurs_during edge');

    // Verify literal edges
    const startTimeQuads = store.getQuads(
      'http://example.org/TI_0',
      'http://www.ontologyrepository.com/CommonCoreOntologies/has_start_time',
      null
    );
    assert.strictEqual(startTimeQuads.length, 1, 'Should have has_start_time literal');
    assert.strictEqual(startTimeQuads[0].object.termType, 'Literal', 'Should be a literal');
  });

  test('extractPredicateIRI should extract IRI from predicate label', () => {
    const label1 = 'participates in<br>IRI: bfo:BFO_0000056';
    const iri1 = mermaidLifter.helpers.extractPredicateIRI(label1);
    assert.strictEqual(iri1, 'http://purl.obolibrary.org/obo/BFO_0000056', 'Should extract BFO IRI');

    const label2 = 'is bearer of<br>IRI: cco:is_bearer_of';
    const iri2 = mermaidLifter.helpers.extractPredicateIRI(label2);
    assert.strictEqual(iri2, 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'Should extract CCO IRI');

    const label3 = 'type<br>IRI: rdf:type';
    const iri3 = mermaidLifter.helpers.extractPredicateIRI(label3);
    assert.strictEqual(iri3, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'Should extract RDF IRI');
  });

  test('expandIRI should expand all standard prefixes', () => {
    // Test various prefixes
    assert.strictEqual(
      mermaidLifter.helpers.expandIRI('owl:Class'),
      'http://www.w3.org/2002/07/owl#Class',
      'Should expand owl: prefix'
    );
    assert.strictEqual(
      mermaidLifter.helpers.expandIRI('skos:Concept'),
      'http://www.w3.org/2004/02/skos/core#Concept',
      'Should expand skos: prefix'
    );
    assert.strictEqual(
      mermaidLifter.helpers.expandIRI('dc:title'),
      'http://purl.org/dc/terms/title',
      'Should expand dc: prefix'
    );
    assert.strictEqual(
      mermaidLifter.helpers.expandIRI('obo:RO_0000052'),
      'http://purl.obolibrary.org/obo/RO_0000052',
      'Should expand obo: prefix'
    );
  });
});
