export const sampleConceptMap = `Research question | | Focuses the study scope
Variables | Research question | Names what changes or is measured
Operational definition | Variables | Makes abstract variables observable
Reliability | Operational definition | Checks consistency of a measure
Validity | Operational definition, Reliability | Checks whether the measure fits the idea
Sampling bias | Research question | Checks who is missing from the sample
Confounding | Variables | Identifies outside explanations
Control group | Confounding | Compares against an untreated baseline`;

export const sampleQuizCsv = `question,concept,stage,result,confidence,note
Q1: Identify the scope in a broad class survey prompt,Research question,pre,correct,3,Scope was visible
Q2: Separate independent and dependent variables,Variables,pre,correct,4,Comfortable with variable roles
Q3: Pick an observable measure for anxiety,Operational definition,pre,wrong,4,Confused construct with instrument
Q4: Interpret a repeated-measure consistency check,Reliability,pre,wrong,3,Need the consistency idea
Q5: Spot a sample made only from volunteers,Sampling bias,pre,wrong,5,Mistook larger sample for representative sample
Q6: Decide if a thermometer measures classroom stress,Validity,post,wrong,4,Mixed validity with reliability
Q7: Choose the likely outside explanation in a sleep study,Confounding,post,correct,3,Could explain both sleep and score
Q8: Explain why a no-intervention group matters,Control group,post,wrong,2,Partly remembered comparison role
Q9: Rewrite a fuzzy motivation scale as an observable behavior,Operational definition,post,correct,4,Definition got measurable
Q10: Judge whether repeated ratings agree,Reliability,post,correct,4,Consistency now clear
Q11: Decide whether a campus-only survey generalizes,Sampling bias,post,wrong,4,Still missed undercoverage
Q12: Link measure consistency before judging fit,Validity; Reliability,post,correct,3,Validity depends on more than agreement`;
