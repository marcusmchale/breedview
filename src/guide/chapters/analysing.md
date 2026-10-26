# Analysing the results

An analysis asks a question of a study's datasets: here, whether the six entries and the two nitrogen rates differ in
height, allowing for the blocks. BreedGraph runs it on its server, then shows the results beside the configuration that
made them, ready to change and run again.

> [!WHO]
> Anyone signed in, on the datasets they can read, once they have accepted the licences of the studies they come
> from.

## Before you start

The data needs to be recorded and checked, as in [Recording observations](/guide/recording) and
[Checking and correcting data](/guide/checking). Bridget Breeder, who reads Field Operations' datasets, analyses the
corrected heights.

![Analysing the results](analysing.mp4)

## Steps

1. **Analyse opens a new analysis of the study.** On the study's Datasets, Analyse opens the analysis with the study
   chosen, and Bridget names it. {#open}
2. **The analysis type, then its datasets.** An ANOVA, of the plant heights and the nitrogen rates. {#data}
3. **Grouping says what each observation belongs to.** Each plot's own germplasm, its entry; and where it stands: in
   Long Meadow, a field, in a block of its layout. {#grouping}
4. **The terms make the model.** Plant height is the response. The nitrogen rate is taken as categorical, two rates,
   beside the germplasm and the block. Estimated means are asked for each entry, and for each rate. {#terms}
5. **Submit runs the analysis, and the results come back.** The ANOVA finds that the entries and the nitrogen rates
   differ beyond chance, and the blocks do not. The estimated means give each entry's height, and each rate's, with
   the differences between them. {#results}
6. **Edit & resubmit asks a further question.** A Septoria score is ordinal: the steps from one score to the next are
   not equal, so it is neither averaged nor an ANOVA's response. Descriptive statistics summarise it as its order
   allows: for each entry, how many plots got each score, and the median and quartiles as scores. {#further}

## Who sees what

> [!SEES]
> An analysis reads only the records its submitter can read. Recent analyses lists your own, until each expires a
> week after it last changed.

> [!DATA]
> An analysis records who submitted it. Its results name entries, places and blocks, not people.

## Try it on the demo site

Sign in as a reviewer, and analyse the public 2024 study in Long Meadow: its grain yield, by entry and block.
