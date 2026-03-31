import { useEffect, useMemo, useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import { getTaxLabel, getUnitLabel } from "@/features/products/constants";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import type { CategoryOption, SubcategoryMap } from "@/features/products/services/products.api";
import type { Product } from "@/features/products/types";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import { useTablePagination } from "@/hooks/useTablePagination";
import ProductCreateView from "@/features/products/views/ProductCreateView";
import ProductEditView from "@/features/products/views/ProductEditView";

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function estimatedUnitProfit(product: Product) {
  const baseSalePrice =
    product.hasTax && product.taxRate > 0 ? product.price / (1 + product.taxRate) : product.price;
  return Math.round(baseSalePrice - product.cost);
}

function categoryLabel(product: Product) {
  if (product.categoryName && product.subcategoryName) {
    return `${product.categoryName} / ${product.subcategoryName}`;
  }

  return product.categoryName || "Sin categoria";
}

function buildSubcategoryMap(categories: Awaited<ReturnType<typeof window.api.listProductCategories>>["categories"]) {
  return Object.fromEntries(
    categories.map((category) => [category.id, category.subcategories])
  ) as SubcategoryMap;
}

export default function ProductListView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [subcategoryMap, setSubcategoryMap] = useState<SubcategoryMap>({});
  const [searchName, setSearchName] = useState("");
  const [searchSku, setSearchSku] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [subcategoryCategory, setSubcategoryCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "info"; message: string } | null>(null);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        window.api.listProductsAdmin(),
        window.api.listProductCategories(),
      ]);

      if (!productsResponse.success) {
        throw new Error(productsResponse.message || "No se pudieron cargar los productos");
      }
      if (!categoriesResponse.success) {
        throw new Error(categoriesResponse.message || "No se pudieron cargar las categorias");
      }

      const categoryRows = categoriesResponse.categories.map((category) => ({
        id: category.id,
        name: category.name,
        isActive: category.isActive,
      }));

      setProducts(productsResponse.products);
      setCategories(categoryRows);
      setSubcategoryMap(buildSubcategoryMap(categoriesResponse.categories));
      setSubcategoryCategory((current) => current || categoryRows[0]?.id || "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar productos";
      setFeedback({ severity: "error", message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    if (!subcategoryCategory && categories.length > 0) {
      setSubcategoryCategory(categories[0].id);
      return;
    }

    if (subcategoryCategory && !categories.some((category) => category.id === subcategoryCategory)) {
      setSubcategoryCategory(categories[0]?.id || "");
    }
  }, [categories, subcategoryCategory]);

  const filteredProducts = useMemo(() => {
    const nameQuery = searchName.trim().toLowerCase();
    const skuQuery = searchSku.trim().toLowerCase();

    return products.filter((product) => {
      const matchesName = !nameQuery || product.name.toLowerCase().includes(nameQuery);
      const matchesSku = !skuQuery || (product.sku ?? "").toLowerCase().includes(skuQuery);
      return matchesName && matchesSku;
    });
  }, [products, searchName, searchSku]);

  const activeCount = products.filter((product) => product.isActive).length;
  const inventoryUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const estimatedValue = products.reduce((sum, product) => sum + product.stock * product.cost, 0);
  const canCreateProducts = hasPermission(user, APP_PERMISSION_KEYS.productsCreate);
  const canEditProducts = hasPermission(user, APP_PERMISSION_KEYS.productsEdit);
  const canArchiveProducts = hasPermission(user, APP_PERMISSION_KEYS.productsDelete);
  const canManageCategories = canEditProducts;
  const productsPagination = useTablePagination(filteredProducts);

  const handleCreateProduct = async (payload: Parameters<typeof window.api.createProductRecord>[0]) => {
    const response = await window.api.createProductRecord(payload);
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo crear el producto" });
      return;
    }
    setFeedback({ severity: "success", message: "Producto creado correctamente." });
    await refreshData();
  };

  const handleEditProduct = async (payload: Omit<Parameters<typeof window.api.updateProductRecord>[0], "id">) => {
    if (!editProduct) return;
    const response = await window.api.updateProductRecord({ id: editProduct.id, ...payload });
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo actualizar el producto" });
      return;
    }
    setFeedback({ severity: "success", message: "Producto actualizado correctamente." });
    setEditProduct(null);
    await refreshData();
  };

  const handleDelete = async (productId: string) => {
    const response = await window.api.deleteProductRecord(productId);
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo archivar el producto" });
      return;
    }
    setFeedback({ severity: "success", message: "Producto archivado." });
    await refreshData();
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    const response = await window.api.createProductCategory(newCategory.trim());
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo crear la categoria" });
      return;
    }
    setNewCategory("");
    await refreshData();
  };

  const handleRemoveCategory = async (categoryId: string) => {
    const response = await window.api.deleteProductCategory(categoryId);
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo eliminar la categoria" });
      return;
    }
    await refreshData();
  };

  const handleAddSubcategory = async () => {
    if (!subcategoryCategory || !newSubcategory.trim()) return;
    const response = await window.api.createProductSubcategory({
      categoryId: subcategoryCategory,
      name: newSubcategory.trim(),
    });
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo crear la subcategoria" });
      return;
    }
    setNewSubcategory("");
    await refreshData();
  };

  const handleRemoveSubcategory = async (subcategoryId: string) => {
    const response = await window.api.deleteProductSubcategory(subcategoryId);
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo eliminar la subcategoria" });
      return;
    }
    await refreshData();
  };

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4">Productos</Typography>
          <Typography variant="body2" color="text.secondary">
            Catalogo conectado a base de datos con categorias y stock real.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          {canManageCategories ? (
            <Button variant="outlined" onClick={() => setCategoriesDialogOpen(true)}>
              Categorias
            </Button>
          ) : null}
          {canCreateProducts ? (
            <Button variant="contained" onClick={() => setCreateOpen(true)}>
              Nuevo producto
            </Button>
          ) : null}
        </Stack>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Productos activos</Typography>
            <Typography variant="h4">{activeCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Unidades en inventario</Typography>
            <Typography variant="h4">{inventoryUnits}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Costo estimado inventario</Typography>
            <Typography variant="h4">{currency(estimatedValue)}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
            <TextField
              label="Buscar por nombre"
              placeholder="Ej: arroz"
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
            />
            <TextField
              label="Buscar por SKU"
              placeholder="Ej: PRD-001"
              value={searchSku}
              onChange={(event) => setSearchSku(event.target.value)}
            />
          </Box>

          {loading ? (
            <Alert severity="info">Cargando productos...</Alert>
          ) : filteredProducts.length === 0 ? (
            <Alert severity="info">No hay productos que coincidan con la busqueda.</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Codigo de barras</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell align="right">Stock</TableCell>
                    <TableCell align="right">Precio venta</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productsPagination.paginatedRows.map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{product.name}</Typography>
                      </TableCell>
                      <TableCell>{product.barcode || "Sin codigo"}</TableCell>
                      <TableCell>{product.sku || "Auto"}</TableCell>
                      <TableCell>{categoryLabel(product)}</TableCell>
                      <TableCell align="right">{product.stock}</TableCell>
                      <TableCell align="right">{currency(product.price)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={product.isActive ? "success" : "error"}
                          label={product.isActive ? "Activo" : "Inactivo"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <IconButton color="primary" onClick={() => setViewProduct(product)} title="Ver resumen">
                            <VisibilityOutlinedIcon />
                          </IconButton>
                          {canEditProducts ? (
                            <IconButton color="primary" onClick={() => setEditProduct(product)} title="Editar producto">
                              <EditOutlinedIcon />
                            </IconButton>
                          ) : null}
                          {canArchiveProducts ? (
                            <IconButton color="error" onClick={() => void handleDelete(product.id)} title="Archivar producto">
                              <DeleteOutlineIcon />
                            </IconButton>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredProducts.length}
                page={productsPagination.page}
                onPageChange={productsPagination.handleChangePage}
                rowsPerPage={productsPagination.rowsPerPage}
                onRowsPerPageChange={productsPagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15]}
                labelRowsPerPage="Filas"
              />
            </Box>
          )}
        </Stack>
      </Card>

      <ProductCreateView
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => void handleCreateProduct(payload)}
        categories={categories}
        subcategoryMap={subcategoryMap}
      />

      <ProductEditView
        open={Boolean(editProduct)}
        product={editProduct}
        onClose={() => setEditProduct(null)}
        onSubmit={(payload) => void handleEditProduct(payload)}
        categories={categories}
        subcategoryMap={subcategoryMap}
      />

      <Dialog open={Boolean(viewProduct)} onClose={() => setViewProduct(null)} fullWidth maxWidth="sm">
        <DialogTitle>Resumen del producto</DialogTitle>
        <DialogContent>
          {viewProduct ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <DetailRow label="Producto" value={viewProduct.name} />
              <DetailRow label="SKU" value={viewProduct.sku || "Auto"} />
              <DetailRow label="Codigo de barras" value={viewProduct.barcode || "Sin codigo"} />
              <DetailRow label="Unidad de medida" value={getUnitLabel(viewProduct.unitMeasure)} />
              <DetailRow label="Categoria" value={categoryLabel(viewProduct)} />
              <DetailRow label="Stock actual" value={String(viewProduct.stock)} />
              <DetailRow label="Costo actual" value={currency(viewProduct.cost)} />
              <DetailRow label="% de ganancia" value={`${viewProduct.marginPercent}%`} />
              <DetailRow label="Utilidad estimada por unidad" value={currency(estimatedUnitProfit(viewProduct))} />
              <DetailRow label="IVA" value={getTaxLabel(viewProduct.hasTax, viewProduct.taxRate)} />
              <DetailRow label="Precio de venta" value={currency(viewProduct.price)} />
              <DetailRow label="Estado" value={viewProduct.isActive ? "Activo" : "Inactivo"} />
              <DetailRow label="Fecha de creacion" value={new Date(viewProduct.createdAt).toLocaleString("es-CO")} />
              <DetailRow label="Registrado por" value={viewProduct.createdBy || "Sin registro"} />
              <DetailRow label="Ultimo cambio" value={viewProduct.updatedBy || viewProduct.createdBy || "Sin registro"} />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewProduct(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categoriesDialogOpen} onClose={() => setCategoriesDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Categorias y subcategorias</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info">
              Las categorias tambien viven en base de datos. Al eliminar una categoria, los productos quedan sin clasificacion.
            </Alert>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={3}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Categorias</Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField label="Nueva categoria" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} fullWidth />
                  <Button variant="contained" onClick={() => void handleAddCategory()}>Agregar</Button>
                </Stack>

                <Divider />

                <Stack spacing={1}>
                  {categories.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Todavia no hay categorias creadas.</Typography>
                  ) : (
                    categories.map((category) => (
                      <Box key={category.id} display="flex" justifyContent="space-between" alignItems="center" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, px: 2, py: 1 }}>
                        <Typography>{category.name}</Typography>
                        <IconButton color="error" onClick={() => void handleRemoveCategory(category.id)}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                    ))
                  )}
                </Stack>
              </Stack>

              <Stack spacing={2}>
                <Typography variant="subtitle1">Subcategorias</Typography>

                <FormControl fullWidth disabled={categories.length === 0}>
                  <InputLabel id="subcategory-category-select-label">Categoria base</InputLabel>
                  <Select
                    labelId="subcategory-category-select-label"
                    value={subcategoryCategory}
                    label="Categoria base"
                    onChange={(event) => setSubcategoryCategory(event.target.value)}
                  >
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField
                    label="Nueva subcategoria"
                    value={newSubcategory}
                    onChange={(event) => setNewSubcategory(event.target.value)}
                    disabled={!subcategoryCategory}
                    fullWidth
                  />
                  <Button variant="contained" onClick={() => void handleAddSubcategory()} disabled={!subcategoryCategory}>
                    Agregar
                  </Button>
                </Stack>

                <Divider />

                <Stack spacing={1}>
                  {!subcategoryCategory ? (
                    <Typography variant="body2" color="text.secondary">Crea una categoria para empezar a usar subcategorias.</Typography>
                  ) : (subcategoryMap[subcategoryCategory] || []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Esta categoria aun no tiene subcategorias.</Typography>
                  ) : (
                    (subcategoryMap[subcategoryCategory] || []).map((subcategory) => (
                      <Box key={subcategory.id} display="flex" justifyContent="space-between" alignItems="center" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, px: 2, py: 1 }}>
                        <Typography>{subcategory.name}</Typography>
                        <IconButton color="error" onClick={() => void handleRemoveSubcategory(subcategory.id)}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                    ))
                  )}
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoriesDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box display="flex" justifyContent="space-between" gap={2} sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} textAlign="right">{value}</Typography>
    </Box>
  );
}
