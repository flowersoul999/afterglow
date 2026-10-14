---
title: Java 反射
published: 2026-03-11
tags:
  - java
description: 嘿，你有没有试过写完代码，突然发现——哎，要是能不改一行源码，光靠配个文件就让程序调用不同的类和方法，那该多爽？Java 反射就是干这个的。它像给 JVM 装了面“魔法镜子”，让你在运行时看清、摸到、甚至调用任何类的里里外外。虽然有点慢，但框架、Spring、Hibernate……全靠它撑腰。来，咱们轻松聊聊这面镜子怎么照、照哪儿、以及别被它闪了眼 😄
descriptionSource: ai
---
## 一、 反射的需求与快速入门

### 1.1 引出反射的需求

- **场景**：根据配置文件（如 re.properties）中的信息（类全路径、方法名），动态创建对象并调用方法。
    
- **优势**：**不修改源码**，仅通过外部配置文件即可控制程序，符合设计模式的**开闭原则（OCP）**。这是框架技术的底层核心。
    

### 1.2 快速入门案例

1. 读取配置文件，获取类全路径 classfullpath 和方法名 methodName。
    
2. **传统** **new** **对象方式行不通**，因为类名在编译时不确定。
    
3. **反射解决方案**：
    

```java
// 1. 加载类，返回Class对象
Class cls = Class.forName(classfullpath);
// 2. 通过Class对象创建运行时实例
Object o = cls.newInstance();
// 3. 通过Class对象获取方法对象（万物皆对象）
Method method1 = cls.getMethod(methodName);
// 4. 通过方法对象调用方法：method1.invoke(o);
```

## 二、 反射机制原理

### 2.1 Java Reflection 定义

- 反射机制允许程序在**运行期**借助 Reflection API 取得任何类的内部信息，并能操作对象的属性和方法。
    
- **原理核心**：类加载后，在堆中会生成一个唯一的 **Class** **类对象**，它像一面“镜子”，包含了该类的完整结构信息（成员变量、构造器、成员方法等）。通过这个 Class 对象可以反向获取类的结构。
    

### 2.2 反射能完成的操作

1. 运行时判断任意对象的类。
    
2. 运行时构造任意类的对象。
    
3. 运行时获取任意类的成员变量和方法。
    
4. 运行时调用任意对象的成员变量和方法。
    
5. 生成动态代理。
    

### 2.3 反射相关的主要类 (java.lang.reflect)

|   |   |   |
|---|---|---|
|类|代表|作用|
|**java.lang.Class**|一个类|表示某个类加载后在堆中的对象。**反射的入口**。|
|**java.lang.reflect.Method**|类的方法|通过 Class 对象获取，代表某个类的方法。|
|**java.lang.reflect.Field**|类的成员变量|通过 Class 对象获取，代表某个类的成员变量。|
|**java.lang.reflect.Constructor**|类的构造方法|通过 Class 对象获取，代表某个类的构造器。|

### 2.4 反射的优缺点与性能优化

- **优点**：**动态性**，使框架具备灵活扩展能力，是框架技术的底层支撑。
    
- **缺点**：主要是**解释执行**，对执行速度有影响。
    
- **性能优化**：通过 Method/Field/Constructor 对象的 setAccessible(true) 方法，可以**关闭访问安全检查（暴破）**，能显著提高反射效率。
    

## 三、 Class 类

### 3.1 Class 类特点

1. Class 也是类，继承自 Object。
    
2. Class 类对象**不是** **new** **出来的**，而是由JVM在类加载时创建的。
    
3. 对于某个类，在内存中**只有一份** Class 对象（因为类只加载一次）。
    
4. 每个对象实例都记得它是由哪个 Class 对象生成的。
    
5. Class 对象包含了类的完整结构，可通过API获取。
    
6. Class 对象存放在**堆**中，类的字节码二进制数据（元数据）存放在**方法区**。
    

### 3.2 获取 Class 类对象的六种方式

|   |   |   |   |
|---|---|---|---|
|方式|代码示例|应用场景|备注|
|**1.** **Class.forName**|Class cls1 = Class.forName("全类名");|**多用于配置文件**，读取全类名，加载类。|可能抛出 ClassNotFoundException。|
|**2. 类名.class**|Class cls2 = Cat.class;|**多用于参数传递**，安全可靠，性能高。|最常用。|
|**3. 对象.getClass()**|Class cls3 = 对象.getClass();|已有对象实例，获取其 Class 对象。|获取对象的运行时类型。|
|**4. 类加载器**|ClassLoader cl = 对象.getClass().getClassLoader();<br><br>Class cls4 = cl.loadClass("全类名");|通过类加载器动态加载。||
|**5. 基本数据类型.class**|Class cls5 = int.class;|获取基本数据类型的 Class 对象。||
|**6. 包装类.TYPE**|Class cls6 = Integer.TYPE;|获取基本数据类型对应包装类的 Class 对象。|与方式5的 Class 对象相同。|

### 3.3 哪些类型有 Class 对象？

- 所有类型都有 Class 对象：外部类、内部类、接口、数组、枚举、注解、基本数据类型、void。
    

## 四、 类加载

### 4.1 静态加载 vs 动态加载

- **静态加载**：编译时加载相关类。如果类不存在，则**编译报错**。依赖性太强。
    
    - _触发时机_：new 对象、访问静态成员、继承等。
        
- **动态加载**：运行时加载需要的类。如果运行时未使用该类，即使不存在也不报错。降低了依赖性。
    
    - _触发时机_：**反射**。
        

### 4.2 类加载过程

1. **加载 (Loading)**：将类的字节码文件读入内存，并为之创建一个 java.lang.Class 对象。
    
2. **连接 (Linking)**：
    
    - **验证 (Verification)**：确保字节码文件符合JVM规范，安全。
        
    - **准备 (Preparation)**：为**静态变量**分配内存并设置**默认初始值**。
        
        - _注意_：static final 修饰的常量，在准备阶段会直接赋值为指定的值。
            
    - **解析 (Resolution)**：将常量池中的符号引用替换为直接引用。
        
3. **初始化 (Initialization)**：执行类构造器 <clinit>() 方法的过程，真正为静态变量赋值并执行静态代码块。JVM保证此过程线程安全。
    

## 五、 通过反射获取类的结构信息

### 5.1 第一组：java.lang.Class 方法

|   |   |
|---|---|
|方法|作用|
|getName()|获取全类名。|
|getSimpleName()|获取简单类名。|
|getFields()|获取所有 **public** 修饰的属性（包含父类的）。|
|getDeclaredFields()|获取**本类中所有**属性（任何修饰符）。|
|getMethods()|获取所有 **public** 修饰的方法（包含父类的）。|
|getDeclaredMethods()|获取**本类中所有**方法。|
|getConstructors()|获取所有 **public** 修饰的构造器。|
|getDeclaredConstructors()|获取**本类中所有**构造器。|
|getPackage()|获取包信息。|
|getSuperclass()|获取父类的 Class 对象。|
|getInterfaces()|获取实现的接口的 Class 数组。|

### 5.2 第二组：java.lang.reflect.Field 方法

|   |   |
|---|---|
|方法|作用|
|getModifiers()|以 int 形式返回修饰符。可配合 Modifier 类解读。|
|getType()|以 Class 形式返回属性类型。|
|getName()|返回属性名。|

### 5.3 第三组：java.lang.reflect.Method 方法

|   |   |
|---|---|
|方法|作用|
|getModifiers()|以 int 形式返回修饰符。|
|getReturnType()|以 Class 形式获取返回类型。|
|getName()|返回方法名。|
|getParameterTypes()|以 Class[] 返回参数类型数组。|

### 5.4 第四组：java.lang.reflect.Constructor 方法

|   |   |
|---|---|
|方法|作用|
|getModifiers()|以 int 形式返回修饰符。|
|getName()|返回构造器名（全类名）。|
|getParameterTypes()|以 Class[] 返回参数类型数组。|

## 六、 通过反射创建对象和访问成员

### 6.1 创建对象

1. **调用无参构造器**（类中必须有 public 无参构造）：
    

```java
Class cls = Class.forName("全类名");
Object o = cls.newInstance(); // 已过时，推荐用构造器
```

2. **调用指定构造器**：
    

```java
// 1. 获取指定参数类型的构造器对象
Constructor constructor = cls.getDeclaredConstructor(参数类型.class, ...);
// 2. 如果是非public构造器，需要暴破
constructor.setAccessible(true);
// 3. 调用构造器创建实例
Object o = constructor.newInstance(实参列表);
```

### 6.2 访问属性

1. 根据属性名获取 Field 对象：Field f = cls.getDeclaredField("属性名");
    
![](https://img.tsh520.cn/file/blog/article/file-20260311202900007.png)


2. 暴破（针对非 public 属性）：f.setAccessible(true);
    
3. 访问：
    

```java
f.set(o, 值); // 设置属性值
f.get(o);     // 获取属性值
```

- _注意_：如果是静态属性，set 和 get 中的对象参数 o 可以写成 null。
    

### 6.3 访问方法

1. 根据方法名和参数列表获取 Method 对象：Method m = cls.getDeclaredMethod("方法名", 参数类型.class, ...);
    
2. 暴破（针对非 public 方法）：m.setAccessible(true);
    
3. 调用：Object returnValue = m.invoke(o, 实参列表);
    
    - _注意_：如果是静态方法，invoke 中的对象参数 o 可以写成 null。
        
    - 返回值类型为 Object，但其实际运行类型与方法定义的返回类型一致。