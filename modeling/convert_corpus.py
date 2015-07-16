#!/usr/bin/python

import sys, re
from gensim import corpora, models
import unidecode
import logging
import numpy
import collections
import time


class MyDocs(object):
    def __init__(self, filename):
        self.filename = filename
    def __iter__(self):
        for line in open(self.filename):
            line = unidecode.unidecode(line.decode('utf-8'))
            line = line.replace('`','\'').replace('\'', ' \' ')
            line = line.replace('/',' / ')
            line = re.sub("\d+([\-,\.]\d+)+", "000", line)
            line = re.sub("\-{2,}", "", line)
            line = re.sub("(^\-|\-$)", "", line)
            line = re.sub("(\s\-|\-\s)", " ", line)
            line = line.replace(":", " : ")
            line = line.replace(",", " , ")
            line = filter(lambda x: x.isalpha() or x.isdigit() or x in ".- ", line)
            line = re.sub("\.\s", " ", line)
            line = line.split()
            line = map(lambda x: x.lower(), line)
            yield line

logging.basicConfig(format='%(asctime)s : %(levelname)s : %(message)s', level=logging.INFO)

print "Reading corpus..."
texts = MyDocs(sys.argv[1])
texts = [text for text in texts]

print "Detecting phrases..."
bigram = models.Phrases(texts)
models.phrases.prune_vocab(bigram.vocab, numpy.percentile(bigram.vocab.values(), 90))

texts = [[token.replace('_', ' ') for token in bigram[text]] for text in texts]

# Generate gensim dictionary
print "Building dictionary..."
dictionary = corpora.Dictionary(texts)

# Save dictionary
if len(sys.argv) > 2:
    dictionary.save(sys.argv[2]+".dict")
else:
    print "Usage: %s <corpus file> <output name>" % sys.argv[0]
    exit()

# Save converted corpus
print "Building BOWs..."
corpus = [dictionary.doc2bow(text) for text in texts]
corpora.MmCorpus.serialize(sys.argv[2]+".mm", corpus)

print "Building word vectors..."

evaluate = False

# Modeling parameters:
#   size = vector size, V
#   window = context size, C
#   iter = epochs, E

for size in [85]:
    for window in [15]:
        start = time.time()
        print "size:",size, ", win:",window
        iter = 10
        logging.basicConfig(format='%(asctime)s : %(levelname)s : %(message)s', level=logging.INFO)
        model = models.Word2Vec(texts, min_count=1, workers=4, size=size, iter=iter, window=window)
        for handler in logging.root.handlers[:]:
            logging.root.removeHandler(handler)
        print "size:",size, ", win:",window, ", time:",time.time()-start
        if evaluate:
            logging.basicConfig(format='size:%d,win:%d,iter:%d' % (size, window, iter) + ' %(message)s', level=logging.INFO, filename="accuracy.log", filemode='a')
            ac = model.accuracy("questions.txt")
        for handler in logging.root.handlers[:]:
            logging.root.removeHandler(handler)
        model.save(sys.argv[2]+".w2v")

