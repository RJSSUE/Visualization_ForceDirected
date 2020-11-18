let _width = $(window).width();
let _height = $(window).height();
let width = _width;
let height = _height;

let data = null;
let data_file = './data/data.json';

let k_Coulomb = -10; // 库伦力常数，符号影响排斥/吸引，负数是排斥
let k_Hooke = 0.005; // 弹簧弹力常数，正数是弹簧拉长时吸引，弹簧实际使用时会乘上学校间共享的人数
let d_Hooke = 50; // 弹簧的标准长度 现在是所有弹簧的标准长度均如此，与弹簧的强度等等无关
let mu = -0.5; // 阻力与速度的比值
let initial_delta_t = 0.3, delta_t = 0.1; // 模拟的时间步的长度，调大会使模拟变快，但可能会导致不精准
// 注意实际采用的delta_t会变化，具体可搜索"delta_t = "来找到对应语句

// 计算质心
let calc_center = function(nodes) {
    let sum_x = 0, sum_y = 0, sum_weight = 0;
    for (i in nodes) {
        sum_x += nodes[i].weight * nodes[i].x;
        sum_y += nodes[i].weight * nodes[i].y;
        sum_weight += nodes[i].weight;
    }
    return [sum_x / sum_weight, sum_y / sum_weight];
};

// 计算每个节点的加速度。
// use_old代表nodes上有没有前一时间步的座标，没有的话不会计算阻力，因为我们的模拟没有计算每一步的速度，因此速度是用座标差除以时间步长度硬算出来的，可能要修改模拟的实现来直接提供速度。
let calc_acceleration = function(nodes, links, nodes_dict, use_old) {
    // nodes[i].Fx和nodes[i].Fy分别代表受力在x, y方向的分量
    for (i in nodes) {
        nodes[i].Fx = 0;
        nodes[i].Fy = 0;
    }

    // 计算库伦力
    for (i in nodes) {
        for (j in nodes) {
            if (i == j) continue;
            let dx = nodes[j].x - nodes[i].x;
            let dy = nodes[j].y - nodes[i].y;
            let d = Math.hypot(dx, dy);
            let F = k_Coulomb * nodes[i].weight * nodes[j].weight / (d * d);
            nodes[i].Fx += F * dx / d;
            nodes[i].Fy += F * dy / d;
        }
    }

    // 计算弹簧弹力
    for (l in links) {
        if (links[l].source == links[l].target) continue;
        let src = nodes_dict[links[l].source];
        let tgt = nodes_dict[links[l].target];
        let dx = src.x - tgt.x;
        let dy = src.y - tgt.y;
        let d = Math.hypot(dx, dy);
        let F = k_Hooke * (d - d_Hooke) * links[l].weight;
        src.Fx += -F * dx / d;
        src.Fy += -F * dy / d;
        tgt.Fx += F * dx / d;
        tgt.Fy += F * dy / d;
    }

    if (use_old) {
        // 计算阻力
        for (i in nodes) {
            nodes[i].Fx += mu * (nodes[i].x - nodes[i].old_x) / delta_t;
            nodes[i].Fy += mu * (nodes[i].y - nodes[i].old_y) / delta_t;
        }
    }

    // 计算加速度
    for (i in nodes) {
        nodes[i].ax = nodes[i].Fx / nodes[i].weight;
        nodes[i].ay = nodes[i].Fy / nodes[i].weight;
    }
};

// 需要实现一个图布局算法，给出每个node的x,y属性
// f是每步的可视化
async function graph_layout_algorithm(nodes, links, nodes_dict, f) {
    // 算法开始时间
    d = new Date()
    begin = d.getTime()

    //这是一个随机布局，请在这一部分实现图布局算法
    // Verlet integration
    // 随机初始化 x_0
    for (i in nodes) {
        nodes[i].x = Math.random() * 0.8 * width + 0.1 * width;
        nodes[i].y = Math.random() * 0.8 * height + 0.1 * height;
    }

    await f();

    for (k = 0; k < 62; ++k) {
        delta_t = Math.log2(k+2) * initial_delta_t; // 逐渐调大时间步以加速收敛
        let borders = {'left': 0.1*width, 'right': 0.9 * width, 'top': 0.1 * height, 'bottom': 0.9 * height};
        for (i in nodes) {
            let check = function(getter, setter, border, less) {
                if (less) {
                    if (getter(nodes[i]) < border) setter(nodes[i], (getter(nodes[i]) - border) * 0.1 + border);
                } else {
                    if (getter(nodes[i]) > border) setter(nodes[i], (getter(nodes[i]) - border) * 0.1 + border);
                }
            };
            check((n) => n.x, (n, x) => n.x = x, borders.left, true);
            check((n) => n.x, (n, x) => n.x = x, borders.right, false);
            check((n) => n.y, (n, x) => n.y = x, borders.top, true);
            check((n) => n.y, (n, x) => n.y = x, borders.bottom, false);
        }
        // x_1
        calc_acceleration(nodes, links, nodes_dict, false);
        for (i in nodes) {
            nodes[i].old_x = nodes[i].x;
            nodes[i].old_y = nodes[i].y;
            nodes[i].x += nodes[i].ax * delta_t * delta_t / 2;
            nodes[i].y += nodes[i].ay * delta_t * delta_t / 2;
        }
        await f();
        
        // x_other
        for (k2 = 0; k2 < 100; k2++) {
            calc_acceleration(nodes, links, nodes_dict, true);
            for (i in nodes) {
                let new_x = 2 * nodes[i].x - nodes[i].old_x + nodes[i].ax * delta_t * delta_t;
                let new_y = 2 * nodes[i].y - nodes[i].old_y + nodes[i].ay * delta_t * delta_t;
                nodes[i].old_x = nodes[i].x;
                nodes[i].old_y = nodes[i].y;
                nodes[i].x = new_x;
                nodes[i].y = new_y;
            }
            await f();
        }
    }

    // 算法结束时间
    d2 = new Date()
    end = d2.getTime()

    // 保存图布局结果和花费时间为json格式，并按提交方式中重命名，提交时请注释这一部分代码
    //var content = JSON.stringify({"time": end-begin, "nodes": nodes, "links": links});
    //var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    //saveAs(blob, "save.json");
}

async function draw_graph() {
    let svg = d3.select('#container')
        .select('svg')
        .attr('width', width)
        .attr('height', height);

    // 数据格式
    // nodes = [{"id": 学校名称, "weight": 毕业学生数量}, ...]
    // links = [{"source": 毕业学校, "target": 任职学校, "weight": 人数}, ...]
    let links = data.links;
    let nodes = data.nodes;

    let nodes_dict = {};
    for (i in nodes) {
        nodes_dict[nodes[i].id] = nodes[i]
    }

    // links
    let link = svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.weight));

    // nodes
    let node = svg.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", d => Math.sqrt(d.weight) * 2 + 0.5)
        .attr("fill", "steelblue")
        .on("mouseover", function (e, d) {// 鼠标移动到node上时显示text
            text
                .attr("display", function (f) {
                    if (f.id == d.id || f.weight > 40) {
                        return "null";
                    }
                    else {
                        return "none";
                    }
                })
        })
        .on("mouseout", function (e, d) {// 鼠标移出node后按条件判断是否显示text
            text
                .attr("display", function (f) {
                    if (f.weight > 40) {
                        return 'null';
                    }
                    else {
                        return 'none';
                    }
                })
        });


    // center of mass
    let center = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .append('circle')
            .attr('r', d => 10)
            .attr('fill', 'red');

    // 学校名称text，只显示满足条件的学校
    let text = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.id)
        .attr("display", function (d) {
            if (d.weight > 40) {
                return 'null';
            }
            else {
                return 'none';
            }
        });

    // 图布局算法
    graph_layout_algorithm(nodes, links, nodes_dict, async function() {
        link
            .attr("x1", d => nodes_dict[d.source].x)
            .attr("y1", d => nodes_dict[d.source].y)
            .attr("x2", d => nodes_dict[d.target].x)
            .attr("y2", d => nodes_dict[d.target].y);
    
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        text
            .attr("x", d => d.x)
            .attr("y", d => d.y);
        
        let [cx, cy] = calc_center(nodes);
        center
            .attr('cx', cx)
            .attr('cy', cy);

        // 这是一个土法sleep，希望有更好的方法
        await new Promise(resolve => (setTimeout(resolve, 1)));
    });

    // 绘制links, nodes和text的位置
    // 绘制已在graph_layout_algorithm中完成
}

function main() {
    d3.json(data_file).then(function (DATA) {
        data = DATA;
        draw_graph();
    })
}

main()