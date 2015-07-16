#!/usr/bin/python

import sys, collections, math
from gensim import corpora, models
import networkx as nx
import matplotlib.pyplot as plt
import pylab
import json
import numpy
import logging

# Network construction parameters
#   number of most frequent terms, N
topn = 500
#   threshold percentile, P
th = 98.5
#   max links per node, L
node_lim = 12

logging.basicConfig(format='%(asctime)s : %(levelname)s : %(message)s', level=logging.INFO)

if len(sys.argv) < 2:
    print "Usage: %s <corpus name>" % sys.argv[0]
    exit()

# Load files
dictionary = corpora.Dictionary.load(sys.argv[1]+".dict")
corpus = corpora.MmCorpus(sys.argv[1]+".mm")

stopwords = set(map(str.strip, open("stopwords.list").read().split('\n')))

print "Loading semantic model..."
sem_model = models.Word2Vec.load("%s.w2v" % sys.argv[1])

termcntr = collections.defaultdict(lambda:0)

for doc in corpus:
    for term, freq in doc:
        termcntr[term] += freq

termtot = float(sum(termcntr.values()))

revdict = dict([(b, a) for a, b in dictionary.items()])

top_terms = [(dictionary[x[0]], x[1]/termtot) for x in sorted(termcntr.items(), key=lambda x: x[1])[-1*topn:]
             if dictionary[x[0]] not in stopwords and len(dictionary[x[0]]) > 1 and
                not dictionary[x[0]].isdigit() and x[1] > 2]


visdict = set()
g = nx.Graph()

bucket = []
terms = [t for t, w in top_terms]
for t_i, t1 in enumerate(terms):
    g.add_node(t1)
    queue = []
    for t2 in terms[(t_i+1):]:
        try:
            sim = sem_model.similarity(t1, t2)
        except KeyError:
            sim = 0
        if sim > 0.0:
            #print t1, t2, sim
            queue.append((sim, t2))
            #for tx, w in [x for x in sem_model.most_similar([t1,t2], topn=20) if termcntr[revdict[x[0]]] > termcntr[revdict[top_terms[0][0]]] and x[1] > 0.6]:
            #    g.add_edge(t1 +'+'+t2, tx, {'w': w})
        bucket.append(sim)
    print t1
    for sim, t2 in sorted(queue)[-50:]:
        #print t2,
        g.add_edge(t1, t2, {'w': sim})
    #print


limit = numpy.percentile(bucket, th)

weights = [x for x in bucket if x > limit]
w_max = max(weights)
w_min = min(weights)
normalize = lambda w: (w-w_min)/(w_max-w_min)

term_weights = collections.defaultdict(lambda: 0)
term_weights.update(dict(top_terms))

for node, edges in g.edge.items():
    if len(edges) > node_lim:
        for node2, data in sorted(g.edge[node].items(),key=lambda x: x[1]['w'])[:(len(edges)-node_lim)]:
            g.remove_edge(node, node2)

connected_nodes = set(reduce(lambda a,b: a+b, [[x[0], x[1]] for x in g.edges(data=True) if x[2]['w'] > limit]))

jsondata = {}
jsondata['nodes'] = [{'name': x[0],
                      'group': x[1]['group'] if 'group' in x[1] else 0,
                      'prop': term_weights[x[0]]
                     } for x in g.nodes(data=True) if x[0] in connected_nodes]
node_id_lookup = dict(zip([x['name'] for x in jsondata['nodes']], range(len(jsondata['nodes']))))
jsondata['links'] = [{'source': node_id_lookup[x[0]], 'target': node_id_lookup[x[1]], 'value': normalize(x[2]['w'])} for x in g.edges(data=True) if x[2]['w'] > limit]

for i, _ in enumerate(jsondata['nodes']):
    try:
        jsondata['nodes'][i]['name'] = jsondata['nodes'][i]['name'].encode('utf-8')
    except:
        jsondata['nodes'][i]['name'] = "///"

open("graph.json","w").write(json.dumps(jsondata))

### TODO: Sem model on corpus to reflext local contexts, focus by most_similar
